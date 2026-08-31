<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Switch as SwitchModel, SwitchInput } from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { switchesApi, buildsApi } from '$lib/api/client';
	import { orderStatusClass } from '$lib/format';
	import { getUserContext } from '$lib/user-context';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';
	import SwitchForm from '$lib/components/SwitchForm.svelte';

	const userContext = getUserContext();

	// 'view' shows SwitchDetails for an existing switch; 'create'/'edit' show
	// SwitchForm. Reloading the grid after a mutation is handled by bumping
	// gridKey, which remounts CollectionGrid (it only fetches on mount/userId
	// change).
	type ModalState =
		| { mode: 'view'; sw: SwitchModel }
		| { mode: 'create' }
		| { mode: 'edit'; sw: SwitchModel }
		| { mode: 'loading' }
		| { mode: 'error'; message: string }
		| { mode: 'closed' };

	let modal = $state<ModalState>({ mode: 'closed' });
	let failedImages = new SvelteSet<string>();
	let viewerOpen = $state(false);
	let gridKey = $state(0);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let blockingBuilds = $state<string[] | null>(null);
	let confirmingDelete = $state(false);

	async function openSwitch(switchId: string) {
		const userId = userContext.userId;
		if (!userId) return;

		modal = { mode: 'loading' };
		try {
			const sw = await switchesApi.getSwitch({ userId, switchId });
			modal = { mode: 'view', sw };
		} catch {
			modal = { mode: 'error', message: 'Could not load this switch.' };
		}
	}

	function openCreate() {
		saveError = null;
		modal = { mode: 'create' };
	}

	function openEdit(sw: SwitchModel) {
		saveError = null;
		modal = { mode: 'edit', sw };
	}

	function closeModal() {
		modal = { mode: 'closed' };
		viewerOpen = false;
		saveError = null;
		deleteError = null;
		blockingBuilds = null;
		confirmingDelete = false;
	}

	async function handleCreate(input: SwitchInput, stagedImage?: File) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const sw = await switchesApi.createSwitch({ userId, switchInput: input });
			if (stagedImage) {
				// The switch itself was created successfully at this point;
				// an image-upload failure here shouldn't be reported as a
				// failed create, so it's swallowed rather than surfaced via
				// saveError (which the created switch no longer applies to).
				await uploadSwitchImage(sw.id ?? '', stagedImage).catch(() => {});
			}
			gridKey += 1;
			closeModal();
		} catch {
			saveError = 'Could not create this switch.';
		} finally {
			saving = false;
		}
	}

	async function handleUpdate(switchId: string, input: SwitchInput) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const sw = await switchesApi.updateSwitch({ userId, switchId, switchInput: input });
			gridKey += 1;
			modal = { mode: 'view', sw };
		} catch (err) {
			if (err instanceof ResponseError) {
				const body = await err.response.json().catch(() => null);
				console.error('updateSwitch failed', err.response.status, body);
			} else {
				console.error('updateSwitch failed', err);
			}
			saveError = 'Could not save your changes.';
		} finally {
			saving = false;
		}
	}

	async function refreshEditingSwitch(switchId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		const sw = await switchesApi.getSwitch({ userId, switchId });
		gridKey += 1;
		if (modal.mode === 'edit') modal = { mode: 'edit', sw };
	}

	async function uploadSwitchImage(switchId: string, file: File) {
		const userId = userContext.userId;
		if (!userId) return;

		const { uploadUrl } = await switchesApi.setSwitchImage({
			userId,
			switchId,
			imageUploadRequest: { contentType: file.type }
		});
		const put = await fetch(uploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': file.type },
			body: file
		});
		if (!put.ok) throw new Error(`upload failed: ${put.status}`);
	}

	async function handleImageUpload(switchId: string, file: File) {
		await uploadSwitchImage(switchId, file);
		await refreshEditingSwitch(switchId);
	}

	async function handleImageRemove(switchId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		await switchesApi.deleteSwitchImage({ userId, switchId });
		await refreshEditingSwitch(switchId);
	}

	async function deleteSwitch(switchId: string, onDelete?: 'detach') {
		const userId = userContext.userId;
		if (!userId) return;

		deleting = true;
		deleteError = null;
		try {
			await switchesApi.deleteSwitch({ userId, switchId, onDelete });
			gridKey += 1;
			closeModal();
		} catch (err) {
			if (err instanceof ResponseError && err.response.status === 409) {
				const body = await err.response.json().catch(() => null);
				const buildIds: string[] = body?.blockingBuildIds ?? [];
				if (buildIds.length > 0) {
					const names = await Promise.all(
						buildIds.map(async (buildId) => {
							try {
								const build = await buildsApi.getBuild({ userId, buildId });
								return build.keyboard?.name ?? 'Untitled build';
							} catch {
								return 'a build';
							}
						})
					);
					blockingBuilds = names;
				} else {
					deleteError = 'This switch is still used by one or more builds.';
				}
			} else {
				deleteError = 'Could not delete this switch.';
			}
		} finally {
			deleting = false;
		}
	}
</script>

{#if userContext.isOwnProfile}
	<div class="flex justify-end p-4 pb-0">
		<button type="button" class="btn btn-accent" onclick={openCreate}>+ Add switch</button>
	</div>
{/if}

{#key gridKey}
	<CollectionGrid
		userId={userContext.userId}
		fetchPage={(userId: string, cursor: string | undefined) =>
			switchesApi.listSwitches({ userId, cursor })}
		itemKey={(sw) => sw.id ?? ''}
		emptyMessage="No switches yet."
		getName={(sw) => sw.name}
		sortOptions={[
			{ label: 'Name', getValue: (sw) => sw.name },
			{ label: 'Brand', getValue: (sw) => sw.brand },
			{ label: 'Order status', getValue: (sw) => sw.orderStatus ?? undefined }
		]}
	>
		{#snippet card(sw)}
			{@const imageFailed = failedImages.has(sw.id ?? '')}
			<button
				type="button"
				class="kc-card flex w-full items-center gap-3 p-4 text-left"
				onclick={() => openSwitch(sw.id ?? '')}
			>
				{#if sw.image?.url && !imageFailed}
					<img
						src={sw.image.url}
						alt={sw.name}
						class="kc-thumb h-16 w-16 shrink-0 object-contain"
						onerror={() => failedImages.add(sw.id ?? '')}
					/>
				{/if}
				<div class="flex min-w-0 flex-1 items-start justify-between gap-2">
					<div class="min-w-0">
						<h2 class="heading-lg truncate text-lg">{sw.name}</h2>
						<p class="text-muted truncate text-sm">{sw.brand}</p>
						{#if sw.type}
							<p class="text-faint font-mono text-xs">{sw.type}</p>
						{/if}
					</div>
					{#if sw.orderStatus}
						<span class="status-badge shrink-0 {orderStatusClass(sw.orderStatus)}">
							{sw.orderStatus}
						</span>
					{/if}
				</div>
			</button>
		{/snippet}
	</CollectionGrid>
{/key}

<Modal open={modal.mode !== 'closed'} onClose={closeModal} obscured={viewerOpen}>
	{#if modal.mode === 'loading'}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if modal.mode === 'error'}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{modal.message}</p>
	{:else if modal.mode === 'view'}
		<SwitchDetails sw={modal.sw} onImageClick={() => (viewerOpen = true)} />

		{#if userContext.isOwnProfile}
			{@const sw = modal.sw}
			<div
				class="mt-6 flex flex-wrap items-center gap-2 border-t pt-4"
				style="border-color: var(--border)"
			>
				<button type="button" class="btn" onclick={() => openEdit(sw)}>Edit</button>
				{#if blockingBuilds}
					<span class="text-sm" style="color: var(--danger)">
						Used in: {blockingBuilds.join(', ')}.
					</span>
					<button
						type="button"
						class="btn"
						disabled={deleting}
						onclick={() => deleteSwitch(sw.id ?? '', 'detach')}
					>
						{deleting ? 'Removing…' : 'Remove from builds & delete'}
					</button>
					<button
						type="button"
						class="btn"
						disabled={deleting}
						onclick={() => (blockingBuilds = null)}
					>
						Cancel
					</button>
				{:else if confirmingDelete}
					<span class="text-sm">Delete "{sw.name}"?</span>
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						disabled={deleting}
						onclick={() => deleteSwitch(sw.id ?? '')}
					>
						{deleting ? 'Deleting…' : 'Confirm delete'}
					</button>
					<button
						type="button"
						class="btn"
						disabled={deleting}
						onclick={() => (confirmingDelete = false)}
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						onclick={() => (confirmingDelete = true)}
					>
						Delete
					</button>
				{/if}
			</div>
			{#if deleteError}
				<p class="mt-2 text-sm" style="color: var(--danger)">{deleteError}</p>
			{/if}
		{/if}
	{:else if modal.mode === 'create'}
		<SwitchForm {saving} error={saveError} onSubmit={handleCreate} onCancel={closeModal} />
	{:else if modal.mode === 'edit'}
		{@const sw = modal.sw}
		<SwitchForm
			initial={sw}
			{saving}
			error={saveError}
			onSubmit={(input) => handleUpdate(sw.id ?? '', input)}
			onCancel={() => (modal = { mode: 'view', sw })}
			onImageUpload={(file) => handleImageUpload(sw.id ?? '', file)}
			onImageRemove={() => handleImageRemove(sw.id ?? '')}
		/>
	{/if}
</Modal>

{#if modal.mode === 'view' && modal.sw.image?.url}
	<ImageViewer
		open={viewerOpen}
		src={modal.sw.image.url}
		alt={modal.sw.name}
		onClose={() => (viewerOpen = false)}
	/>
{/if}
