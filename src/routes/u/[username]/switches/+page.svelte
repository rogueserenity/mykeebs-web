<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Switch as SwitchModel, SwitchInput } from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { switchesApi, buildsApi } from '$lib/api/client';
	import { formatPrice, orderStatusClass } from '$lib/format';
	import { getUserContext } from '$lib/user-context';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';
	import SwitchForm from '$lib/components/SwitchForm.svelte';

	const userContext = getUserContext();
	const currency = $derived(userContext.profile.preferences?.currency ?? 'USD');
	const showPrice = $derived(
		userContext.isOwnProfile
			? (userContext.profile.preferences?.showPriceToMe ?? true)
			: (userContext.profile.preferences?.showPriceToOthers ?? false)
	);

	type ModalState =
		| { mode: 'view'; sw: SwitchModel }
		| { mode: 'create' }
		| { mode: 'edit'; sw: SwitchModel }
		| { mode: 'loading' }
		| { mode: 'error'; message: string }
		| { mode: 'closed' };

	let modal = $state<ModalState>({ mode: 'closed' });
	// Keyed by URL, not item id: the API hands back a freshly signed URL when
	// the old one expires, so a new key retries instead of staying hidden.
	let failedImages = new SvelteSet<string>();
	let viewerOpen = $state(false);
	let grid = $state<ReturnType<typeof CollectionGrid<SwitchModel>> | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let blockingBuilds = $state<string[] | null>(null);
	let confirmingDelete = $state(false);
	let formDirty = $state(false);

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
		formDirty = false;
		modal = { mode: 'create' };
	}

	function openEdit(sw: SwitchModel) {
		saveError = null;
		formDirty = false;
		modal = { mode: 'edit', sw };
	}

	function closeModal() {
		modal = { mode: 'closed' };
		viewerOpen = false;
		saveError = null;
		deleteError = null;
		blockingBuilds = null;
		confirmingDelete = false;
		formDirty = false;
	}

	async function handleCreate(input: SwitchInput, stagedImage?: File) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const sw = await switchesApi.createSwitch({ userId, switchInput: input });
			if (stagedImage) {
				// The switch already exists, so an upload failure isn't a failed
				// create and saveError no longer applies to it.
				await uploadSwitchImage(sw.id ?? '', stagedImage).catch(() => {});
			}
			await grid?.refresh();
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
			await grid?.refresh();
			modal = { mode: 'view', sw };
			formDirty = false;
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
		await grid?.refresh();
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
			await grid?.refresh();
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

<CollectionGrid
	bind:this={grid}
	userId={userContext.userId}
	fetchPage={(userId: string, cursor: string | undefined) =>
		switchesApi.listSwitches({ userId, cursor })}
	itemKey={(sw) => sw.id ?? ''}
	emptyMessage="No switches yet."
	getName={(sw) => sw.name}
	getOrderStatus={(sw) => sw.orderStatus ?? undefined}
	onAdd={userContext.isOwnProfile ? openCreate : undefined}
	addLabel="Add switch"
	sortOptions={userContext.isOwnProfile
		? [
				{ label: 'Name', getValue: (sw) => sw.name },
				{ label: 'Brand', getValue: (sw) => sw.brand },
				{ label: 'Order status', getValue: (sw) => sw.orderStatus ?? undefined },
				{ label: 'Price', getValue: (sw) => sw.price ?? undefined }
			]
		: [
				{ label: 'Name', getValue: (sw) => sw.name },
				{ label: 'Brand', getValue: (sw) => sw.brand },
				{ label: 'Order status', getValue: (sw) => sw.orderStatus ?? undefined }
			]}
>
	{#snippet card(sw)}
		{@const imageFailed = sw.image?.url != null && failedImages.has(sw.image.url)}
		<button
			type="button"
			class="kc-card flex w-full items-start gap-3 p-4 text-left"
			onclick={() => openSwitch(sw.id ?? '')}
		>
			{#if sw.image?.url && !imageFailed}
				<img
					src={sw.image.url}
					alt={sw.name}
					class="kc-thumb h-16 w-16 shrink-0 object-contain"
					loading="lazy"
					decoding="async"
					onerror={() => sw.image?.url && failedImages.add(sw.image.url)}
				/>
			{/if}
			<div class="min-w-0 flex-1">
				<h2 class="heading-lg truncate text-lg" title={sw.name}>{sw.name}</h2>
				<p class="text-muted truncate text-sm" title={sw.brand}>{sw.brand}</p>
				{#if sw.type}
					<p class="text-faint font-mono text-xs">{sw.type}</p>
				{/if}
				{#if formatPrice(sw.price, currency) || sw.orderStatus}
					<div class="flex items-center gap-2">
						<p class="text-faint font-mono text-xs">{formatPrice(sw.price, currency)}</p>
						{#if sw.orderStatus}
							<span class="status-badge ml-auto shrink-0 {orderStatusClass(sw.orderStatus)}">
								{sw.orderStatus}
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal open={modal.mode !== 'closed'} onClose={closeModal} obscured={viewerOpen} dirty={formDirty}>
	{#if modal.mode === 'loading'}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if modal.mode === 'error'}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{modal.message}</p>
	{:else if modal.mode === 'view'}
		<SwitchDetails sw={modal.sw} onImageClick={() => (viewerOpen = true)} {currency} {showPrice} />

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
		<SwitchForm
			{saving}
			error={saveError}
			onSubmit={handleCreate}
			onCancel={closeModal}
			bind:dirty={formDirty}
		/>
	{:else if modal.mode === 'edit'}
		{@const sw = modal.sw}
		<SwitchForm
			initial={sw}
			{saving}
			error={saveError}
			onSubmit={(input) => handleUpdate(sw.id ?? '', input)}
			onCancel={() => {
				modal = { mode: 'view', sw };
				formDirty = false;
			}}
			onImageUpload={(file) => handleImageUpload(sw.id ?? '', file)}
			onImageRemove={() => handleImageRemove(sw.id ?? '')}
			bind:dirty={formDirty}
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
