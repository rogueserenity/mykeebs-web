<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Keyboard, KeyboardInput } from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { keyboardsApi, buildsApi } from '$lib/api/client';
	import { formatPrice, orderStatusClass } from '$lib/format';
	import { getUserContext } from '$lib/user-context';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import KeyboardDetails from '$lib/components/KeyboardDetails.svelte';
	import KeyboardForm from '$lib/components/KeyboardForm.svelte';
	import VisibilityBadge from '$lib/components/VisibilityBadge.svelte';

	const userContext = getUserContext();
	const currency = $derived(userContext.profile.preferences?.currency ?? 'USD');
	const showPrice = $derived(
		userContext.isOwnProfile
			? (userContext.profile.preferences?.showPriceToMe ?? true)
			: (userContext.profile.preferences?.showPriceToOthers ?? false)
	);

	type ModalState =
		| { mode: 'view'; keyboard: Keyboard }
		| { mode: 'create' }
		| { mode: 'edit'; keyboard: Keyboard }
		| { mode: 'loading' }
		| { mode: 'error'; message: string }
		| { mode: 'closed' };

	let modal = $state<ModalState>({ mode: 'closed' });
	// Keyed by URL, not item id: the API hands back a freshly signed URL when
	// the old one expires, so a new key retries instead of staying hidden.
	let failedImages = new SvelteSet<string>();
	let galleryViewerOpen = $state(false);
	let galleryIndex = $state(0);
	let grid = $state<ReturnType<typeof CollectionGrid<Keyboard>> | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let blockingBuilds = $state<string[] | null>(null);
	let confirmingDelete = $state(false);
	let formDirty = $state(false);

	async function openKeyboard(keyboardId: string) {
		const userId = userContext.userId;
		if (!userId) return;

		modal = { mode: 'loading' };
		try {
			const keyboard = await keyboardsApi.getKeyboard({ userId, keyboardId });
			modal = { mode: 'view', keyboard };
		} catch {
			modal = { mode: 'error', message: 'Could not load this keyboard.' };
		}
	}

	function openCreate() {
		saveError = null;
		formDirty = false;
		modal = { mode: 'create' };
	}

	function openEdit(keyboard: Keyboard) {
		saveError = null;
		formDirty = false;
		modal = { mode: 'edit', keyboard };
	}

	function closeModal() {
		modal = { mode: 'closed' };
		galleryViewerOpen = false;
		galleryIndex = 0;
		saveError = null;
		deleteError = null;
		blockingBuilds = null;
		confirmingDelete = false;
		formDirty = false;
	}

	async function handleCreate(input: KeyboardInput, stagedImages?: File[]) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const keyboard = await keyboardsApi.createKeyboard({ userId, keyboardInput: input });
			if (stagedImages && stagedImages.length > 0) {
				// The keyboard already exists, so an upload failure isn't a failed
				// create and saveError no longer applies to it.
				await Promise.all(
					stagedImages.map((file) => uploadKeyboardImage(keyboard.id ?? '', file).catch(() => {}))
				);
			}
			await grid?.refresh();
			closeModal();
		} catch {
			saveError = 'Could not create this keyboard.';
		} finally {
			saving = false;
		}
	}

	async function handleUpdate(keyboardId: string, input: KeyboardInput) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const keyboard = await keyboardsApi.updateKeyboard({
				userId,
				keyboardId,
				keyboardInput: input
			});
			await grid?.refresh();
			modal = { mode: 'view', keyboard };
			formDirty = false;
		} catch (err) {
			if (err instanceof ResponseError) {
				const body = await err.response.json().catch(() => null);
				console.error('updateKeyboard failed', err.response.status, body);
			} else {
				console.error('updateKeyboard failed', err);
			}
			saveError = 'Could not save your changes.';
		} finally {
			saving = false;
		}
	}

	async function refreshEditingKeyboard(keyboardId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		const keyboard = await keyboardsApi.getKeyboard({ userId, keyboardId });
		await grid?.refresh();
		if (modal.mode === 'edit') modal = { mode: 'edit', keyboard };
	}

	async function uploadKeyboardImage(keyboardId: string, file: File) {
		const userId = userContext.userId;
		if (!userId) return;

		const { uploadUrl } = await keyboardsApi.createKeyboardImage({
			userId,
			keyboardId,
			imageUploadRequest: { contentType: file.type }
		});
		const put = await fetch(uploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': file.type },
			body: file
		});
		if (!put.ok) throw new Error(`upload failed: ${put.status}`);
	}

	async function handleImageUpload(keyboardId: string, file: File) {
		await uploadKeyboardImage(keyboardId, file);
		await refreshEditingKeyboard(keyboardId);
	}

	async function handleImageRemove(keyboardId: string, imageId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		await keyboardsApi.deleteKeyboardImage({ userId, keyboardId, imageId });
		galleryIndex = 0;
		await refreshEditingKeyboard(keyboardId);
	}

	async function deleteKeyboard(keyboardId: string, onDelete?: 'detach') {
		const userId = userContext.userId;
		if (!userId) return;

		deleting = true;
		deleteError = null;
		try {
			await keyboardsApi.deleteKeyboard({ userId, keyboardId, onDelete });
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
					deleteError = 'This keyboard is still used by one or more builds.';
				}
			} else {
				deleteError = 'Could not delete this keyboard.';
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
		keyboardsApi.listKeyboards({ userId, cursor })}
	itemKey={(keyboard) => keyboard.id ?? ''}
	emptyMessage="No keyboards yet."
	getName={(keyboard) => keyboard.name}
	getOrderStatus={(keyboard) => keyboard.orderStatus ?? undefined}
	onAdd={userContext.isOwnProfile ? openCreate : undefined}
	addLabel="Add keyboard"
	sortOptions={userContext.isOwnProfile
		? [
				{ label: 'Name', getValue: (keyboard) => keyboard.name },
				{ label: 'Brand', getValue: (keyboard) => keyboard.brand },
				{ label: 'Order status', getValue: (keyboard) => keyboard.orderStatus ?? undefined },
				{ label: 'Price', getValue: (keyboard) => keyboard.price ?? undefined },
				{ label: 'Visibility', getValue: (keyboard) => keyboard.visibility }
			]
		: [
				{ label: 'Name', getValue: (keyboard) => keyboard.name },
				{ label: 'Brand', getValue: (keyboard) => keyboard.brand },
				{ label: 'Order status', getValue: (keyboard) => keyboard.orderStatus ?? undefined }
			]}
>
	{#snippet card(keyboard)}
		{@const imageFailed = keyboard.image?.url != null && failedImages.has(keyboard.image.url)}
		<button
			type="button"
			class="kc-card flex w-full items-start gap-3 p-4 text-left"
			onclick={() => openKeyboard(keyboard.id ?? '')}
		>
			{#if keyboard.image?.url && !imageFailed}
				<img
					src={keyboard.image.url}
					alt={keyboard.name}
					class="kc-thumb h-16 w-16 shrink-0 object-contain"
					loading="lazy"
					decoding="async"
					onerror={() => keyboard.image?.url && failedImages.add(keyboard.image.url)}
				/>
			{/if}
			<div class="min-w-0 flex-1">
				<h2 class="heading-lg truncate text-lg" title={keyboard.name}>{keyboard.name}</h2>
				<p class="text-muted truncate text-sm" title={keyboard.brand}>{keyboard.brand}</p>
				{#if keyboard.size || keyboard.layout}
					<p class="text-faint font-mono text-xs">
						{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}
					</p>
				{/if}
				{#if formatPrice(keyboard.price, currency) || keyboard.orderStatus || keyboard.visibility}
					<div class="mt-1 flex flex-wrap items-center gap-2">
						<p class="text-faint font-mono text-xs">{formatPrice(keyboard.price, currency)}</p>
						<div class="ml-auto flex shrink-0 items-center gap-1.5">
							{#if keyboard.orderStatus}
								<span class="status-badge {orderStatusClass(keyboard.orderStatus)}">
									{keyboard.orderStatus}
								</span>
							{/if}
							<VisibilityBadge visibility={keyboard.visibility} />
						</div>
					</div>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={modal.mode !== 'closed'}
	onClose={closeModal}
	obscured={galleryViewerOpen}
	dirty={formDirty}
>
	{#if modal.mode === 'loading'}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if modal.mode === 'error'}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{modal.message}</p>
	{:else if modal.mode === 'view'}
		<KeyboardDetails
			keyboard={modal.keyboard}
			onImageClick={(index) => {
				galleryIndex = index;
				galleryViewerOpen = true;
			}}
			{currency}
			{showPrice}
		/>

		{#if userContext.isOwnProfile}
			{@const keyboard = modal.keyboard}
			<div
				class="mt-6 flex flex-wrap items-center gap-2 border-t pt-4"
				style="border-color: var(--border)"
			>
				<button type="button" class="btn" onclick={() => openEdit(keyboard)}>Edit</button>
				{#if blockingBuilds}
					<span class="text-sm" style="color: var(--danger)">
						Used in: {blockingBuilds.join(', ')}.
					</span>
					<button
						type="button"
						class="btn"
						disabled={deleting}
						onclick={() => deleteKeyboard(keyboard.id ?? '', 'detach')}
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
					<span class="text-sm">Delete "{keyboard.name}"?</span>
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						disabled={deleting}
						onclick={() => deleteKeyboard(keyboard.id ?? '')}
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
		<KeyboardForm
			{saving}
			error={saveError}
			onSubmit={handleCreate}
			onCancel={closeModal}
			bind:dirty={formDirty}
		/>
	{:else if modal.mode === 'edit'}
		{@const keyboard = modal.keyboard}
		<KeyboardForm
			initial={keyboard}
			{saving}
			error={saveError}
			onSubmit={(input) => handleUpdate(keyboard.id ?? '', input)}
			onCancel={() => {
				modal = { mode: 'view', keyboard };
				formDirty = false;
			}}
			onImageUpload={(file) => handleImageUpload(keyboard.id ?? '', file)}
			onImageRemove={(imageId) => handleImageRemove(keyboard.id ?? '', imageId)}
			bind:dirty={formDirty}
		/>
	{/if}
</Modal>

{#if modal.mode === 'view' && modal.keyboard.images && modal.keyboard.images.length > 0}
	{@const images = modal.keyboard.images}
	<ImageViewer
		open={galleryViewerOpen}
		src={images[Math.min(galleryIndex, images.length - 1)].url}
		alt={modal.keyboard.name}
		onClose={() => (galleryViewerOpen = false)}
		onPrev={images.length > 1
			? () => (galleryIndex = (galleryIndex - 1 + images.length) % images.length)
			: undefined}
		onNext={images.length > 1
			? () => (galleryIndex = (galleryIndex + 1) % images.length)
			: undefined}
	/>
{/if}
