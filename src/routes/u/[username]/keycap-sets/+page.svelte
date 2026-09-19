<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type {
		KeycapKit,
		KeycapKitInput,
		KeycapSet,
		KeycapSetInput
	} from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { keycapSetsApi, buildsApi } from '$lib/api/client';
	import { getUserContext } from '$lib/user-context';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import KeycapSetDetails from '$lib/components/KeycapSetDetails.svelte';
	import KeycapSetForm from '$lib/components/KeycapSetForm.svelte';
	import KeycapKitForm from '$lib/components/KeycapKitForm.svelte';
	import KeycapKitDetails from '$lib/components/KeycapKitDetails.svelte';
	import { formatPrice, orderStatusClass } from '$lib/format';

	const userContext = getUserContext();
	const currency = $derived(userContext.profile.preferences?.currency ?? 'USD');
	const showPrice = $derived(
		userContext.isOwnProfile
			? (userContext.profile.preferences?.showPriceToMe ?? true)
			: (userContext.profile.preferences?.showPriceToOthers ?? false)
	);

	type ModalState =
		| { mode: 'view'; set: KeycapSet }
		| { mode: 'create' }
		| { mode: 'edit'; set: KeycapSet }
		| { mode: 'loading' }
		| { mode: 'error'; message: string }
		| { mode: 'closed' };

	// Kits are named by id and looked up fresh from the current set on each
	// render, so they stay in sync after a save.
	type KitModalState =
		| { mode: 'view'; kitId: string }
		| { mode: 'create' }
		| { mode: 'edit'; kitId: string }
		| { mode: 'closed' };

	let modal = $state<ModalState>({ mode: 'closed' });
	let kitModal = $state<KitModalState>({ mode: 'closed' });
	let failedImages = new SvelteSet<string>();
	let kitImageViewerOpen = $state(false);
	let grid = $state<ReturnType<typeof CollectionGrid<KeycapSet>> | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let blockingBuilds = $state<string[] | null>(null);
	let confirmingDelete = $state(false);
	let kitSaving = $state(false);
	let kitSaveError = $state<string | null>(null);
	let kitDeleting = $state(false);
	let kitDeleteError = $state<string | null>(null);
	let kitBlockingBuilds = $state<string[] | null>(null);
	let confirmingKitDelete = $state<string | null>(null);
	let formDirty = $state(false);
	let kitFormDirty = $state(false);

	let activeKitId = $derived(
		kitModal.mode === 'view' || kitModal.mode === 'edit' ? kitModal.kitId : null
	);
	let activeKit = $derived(
		modal.mode === 'view' && activeKitId
			? (modal.set.kits?.find((kit) => kit.kitId === activeKitId) ?? null)
			: null
	);

	function stepKit(delta: 1 | -1) {
		if (modal.mode !== 'view' || kitModal.mode !== 'view') return;
		const kits = modal.set.kits;
		const currentKitId = kitModal.kitId;
		if (!kits || kits.length < 2) return;
		const index = kits.findIndex((kit) => kit.kitId === currentKitId);
		if (index === -1) return;
		kitModal = { mode: 'view', kitId: kits[(index + delta + kits.length) % kits.length].kitId };
	}

	function handleKitNavKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') stepKit(-1);
		else if (event.key === 'ArrowRight') stepKit(1);
	}

	let hasMultipleKits = $derived(modal.mode === 'view' ? (modal.set.kits?.length ?? 0) > 1 : false);

	async function openSet(keycapSetId: string) {
		const userId = userContext.userId;
		if (!userId) return;

		modal = { mode: 'loading' };
		try {
			const set = await keycapSetsApi.getKeycapSet({ userId, keycapSetId });
			modal = { mode: 'view', set };
		} catch {
			modal = { mode: 'error', message: 'Could not load this keycap set.' };
		}
	}

	function openCreate() {
		saveError = null;
		formDirty = false;
		modal = { mode: 'create' };
	}

	function openEdit(set: KeycapSet) {
		saveError = null;
		formDirty = false;
		modal = { mode: 'edit', set };
	}

	function closeModal() {
		modal = { mode: 'closed' };
		kitModal = { mode: 'closed' };
		kitImageViewerOpen = false;
		saveError = null;
		deleteError = null;
		blockingBuilds = null;
		confirmingDelete = false;
		formDirty = false;
		resetKitState();
	}

	function resetKitState() {
		kitSaveError = null;
		kitDeleteError = null;
		kitBlockingBuilds = null;
		confirmingKitDelete = null;
		kitFormDirty = false;
	}

	async function handleCreate(input: KeycapSetInput) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const set = await keycapSetsApi.createKeycapSet({ userId, keycapSetInput: input });
			await grid?.refresh();
			// The next step is adding kits, which needs the set's view.
			modal = { mode: 'view', set };
			formDirty = false;
		} catch {
			saveError = 'Could not create this keycap set.';
		} finally {
			saving = false;
		}
	}

	async function handleUpdate(keycapSetId: string, input: KeycapSetInput) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const set = await keycapSetsApi.updateKeycapSet({
				userId,
				keycapSetId,
				keycapSetInput: input
			});
			await grid?.refresh();
			modal = { mode: 'view', set };
			formDirty = false;
		} catch (err) {
			if (err instanceof ResponseError) {
				const body = await err.response.json().catch(() => null);
				console.error('updateKeycapSet failed', err.response.status, body);
			} else {
				console.error('updateKeycapSet failed', err);
			}
			saveError = 'Could not save your changes.';
		} finally {
			saving = false;
		}
	}

	async function refreshViewedSet(keycapSetId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		const set = await keycapSetsApi.getKeycapSet({ userId, keycapSetId });
		await grid?.refresh();
		if (modal.mode === 'view') modal = { mode: 'view', set };
		else if (modal.mode === 'edit') modal = { mode: 'edit', set };
	}

	async function deleteSet(keycapSetId: string, onDelete?: 'detach') {
		const userId = userContext.userId;
		if (!userId) return;

		deleting = true;
		deleteError = null;
		try {
			await keycapSetsApi.deleteKeycapSet({ userId, keycapSetId, onDelete });
			await grid?.refresh();
			closeModal();
		} catch (err) {
			if (err instanceof ResponseError && err.response.status === 409) {
				const body = await err.response.json().catch(() => null);
				const buildIds: string[] = body?.blockingBuildIds ?? [];
				if (buildIds.length > 0) {
					blockingBuilds = await resolveBuildNames(userId, buildIds);
				} else {
					deleteError = 'This keycap set is still used by one or more builds.';
				}
			} else {
				deleteError = 'Could not delete this keycap set.';
			}
		} finally {
			deleting = false;
		}
	}

	async function resolveBuildNames(userId: string, buildIds: string[]): Promise<string[]> {
		return Promise.all(
			buildIds.map(async (buildId) => {
				try {
					const build = await buildsApi.getBuild({ userId, buildId });
					return build.keyboard?.name ?? 'Untitled build';
				} catch {
					return 'a build';
				}
			})
		);
	}

	function openAddKit() {
		resetKitState();
		kitModal = { mode: 'create' };
	}

	function openViewKit(kit: KeycapKit) {
		resetKitState();
		kitImageViewerOpen = false;
		kitModal = { mode: 'view', kitId: kit.kitId };
	}

	function openEditKit(kitId: string) {
		resetKitState();
		kitModal = { mode: 'edit', kitId };
	}

	function closeKitModal() {
		kitModal = { mode: 'closed' };
		kitImageViewerOpen = false;
		resetKitState();
	}

	async function handleCreateKit(input: KeycapKitInput, stagedImage?: File) {
		const userId = userContext.userId;
		if (modal.mode !== 'view' || !userId) return;
		const keycapSetId = modal.set.id;

		kitSaving = true;
		kitSaveError = null;
		try {
			const kit = await keycapSetsApi.createKeycapKit({
				userId,
				keycapSetId,
				keycapKitInput: input
			});
			if (stagedImage) {
				// The kit already exists, so an upload failure isn't a failed
				// create and kitSaveError no longer applies to it.
				await uploadKitImage(keycapSetId, kit.kitId, stagedImage).catch(() => {});
			}
			await refreshViewedSet(keycapSetId);
			closeKitModal();
		} catch {
			kitSaveError = 'Could not create this kit.';
		} finally {
			kitSaving = false;
		}
	}

	async function handleUpdateKit(kitId: string, input: KeycapKitInput) {
		const userId = userContext.userId;
		if (modal.mode !== 'view' || !userId) return;
		const keycapSetId = modal.set.id;

		kitSaving = true;
		kitSaveError = null;
		try {
			await keycapSetsApi.updateKeycapKit({ userId, keycapSetId, kitId, keycapKitInput: input });
			await refreshViewedSet(keycapSetId);
			kitModal = { mode: 'view', kitId };
			kitFormDirty = false;
		} catch (err) {
			if (err instanceof ResponseError) {
				const body = await err.response.json().catch(() => null);
				console.error('updateKeycapKit failed', err.response.status, body);
			} else {
				console.error('updateKeycapKit failed', err);
			}
			kitSaveError = 'Could not save your changes.';
		} finally {
			kitSaving = false;
		}
	}

	async function uploadKitImage(keycapSetId: string, kitId: string, file: File) {
		const userId = userContext.userId;
		if (!userId) return;

		const { uploadUrl } = await keycapSetsApi.setKeycapKitImage({
			userId,
			keycapSetId,
			kitId,
			imageUploadRequest: { contentType: file.type }
		});
		const put = await fetch(uploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': file.type },
			body: file
		});
		if (!put.ok) throw new Error(`upload failed: ${put.status}`);
	}

	async function handleKitImageUpload(kitId: string, file: File) {
		if (modal.mode !== 'view') return;
		const keycapSetId = modal.set.id;
		await uploadKitImage(keycapSetId, kitId, file);
		await refreshViewedSet(keycapSetId);
	}

	async function handleKitImageRemove(kitId: string) {
		const userId = userContext.userId;
		if (modal.mode !== 'view' || !userId) return;
		const keycapSetId = modal.set.id;
		await keycapSetsApi.deleteKeycapKitImage({ userId, keycapSetId, kitId });
		await refreshViewedSet(keycapSetId);
	}

	async function deleteKit(kitId: string, onDelete?: 'detach') {
		const userId = userContext.userId;
		if (modal.mode !== 'view' || !userId) return;
		const keycapSetId = modal.set.id;

		kitDeleting = true;
		kitDeleteError = null;
		try {
			await keycapSetsApi.deleteKeycapKit({ userId, keycapSetId, kitId, onDelete });
			await refreshViewedSet(keycapSetId);
			closeKitModal();
			confirmingKitDelete = null;
		} catch (err) {
			if (err instanceof ResponseError && err.response.status === 409) {
				const body = await err.response.json().catch(() => null);
				const buildIds: string[] = body?.blockingBuildIds ?? [];
				if (buildIds.length > 0) {
					kitBlockingBuilds = await resolveBuildNames(userId, buildIds);
				} else {
					kitDeleteError = 'This kit is still used by one or more builds.';
				}
			} else {
				kitDeleteError = 'Could not delete this kit.';
			}
		} finally {
			kitDeleting = false;
		}
	}
</script>

<CollectionGrid
	bind:this={grid}
	userId={userContext.userId}
	fetchPage={(userId: string, cursor: string | undefined) =>
		keycapSetsApi.listKeycapSets({ userId, cursor })}
	itemKey={(set) => set.id ?? ''}
	emptyMessage="No keycap sets yet."
	getName={(set) => set.name}
	getOrderStatus={(set) => set.orderStatus ?? undefined}
	onAdd={userContext.isOwnProfile ? openCreate : undefined}
	addLabel="Add keycap set"
	sortOptions={userContext.isOwnProfile
		? [
				{ label: 'Name', getValue: (set) => set.name },
				{ label: 'Brand', getValue: (set) => set.brand },
				{ label: 'Order status', getValue: (set) => set.orderStatus ?? undefined },
				{ label: 'Total cost', getValue: (set) => set.totalCost ?? undefined }
			]
		: [
				{ label: 'Name', getValue: (set) => set.name },
				{ label: 'Brand', getValue: (set) => set.brand },
				{ label: 'Order status', getValue: (set) => set.orderStatus ?? undefined }
			]}
>
	{#snippet card(set)}
		{@const imageFailed = failedImages.has(set.id ?? '')}
		<button
			type="button"
			class="kc-card flex w-full items-start gap-3 overflow-hidden p-3 text-left"
			onclick={() => openSet(set.id ?? '')}
		>
			{#if set.primaryKitImage?.url && !imageFailed}
				<img
					src={set.primaryKitImage.url}
					alt={set.name}
					class="kc-thumb h-16 w-16 shrink-0 object-contain"
					loading="lazy"
					decoding="async"
					onerror={() => failedImages.add(set.id ?? '')}
				/>
			{/if}
			<div class="min-w-0 flex-1">
				<h2 class="heading-lg truncate text-lg" title={set.name}>{set.name}</h2>
				<p class="text-muted truncate text-sm" title={set.brand}>{set.brand}</p>
				{#if set.profile}
					<p class="text-faint font-mono text-xs">{set.profile}</p>
				{/if}
				{#if formatPrice(set.totalCost, currency) || set.orderStatus}
					<div class="flex items-center gap-2">
						<p class="text-faint font-mono text-xs">{formatPrice(set.totalCost, currency)}</p>
						{#if set.orderStatus}
							<span class="status-badge ml-auto shrink-0 {orderStatusClass(set.orderStatus)}">
								{set.orderStatus}
							</span>
						{/if}
					</div>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={modal.mode !== 'closed'}
	onClose={closeModal}
	obscured={kitModal.mode !== 'closed'}
	dirty={formDirty}
>
	{#if modal.mode === 'loading'}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if modal.mode === 'error'}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{modal.message}</p>
	{:else if modal.mode === 'view'}
		{@const set = modal.set}
		<KeycapSetDetails
			{set}
			failedImages={new Set(failedImages)}
			onImageError={(kitId) => failedImages.add(kitId)}
			onKitClick={openViewKit}
			onAddKit={userContext.isOwnProfile ? openAddKit : undefined}
		/>

		{#if userContext.isOwnProfile}
			<div
				class="mt-6 flex flex-wrap items-center gap-2 border-t pt-4"
				style="border-color: var(--border)"
			>
				<button type="button" class="btn" onclick={() => openEdit(set)}>Edit set</button>
				{#if blockingBuilds}
					<span class="text-sm" style="color: var(--danger)">
						Used in: {blockingBuilds.join(', ')}.
					</span>
					<button
						type="button"
						class="btn"
						disabled={deleting}
						onclick={() => deleteSet(set.id ?? '', 'detach')}
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
					<span class="text-sm">Delete "{set.name}"?</span>
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						disabled={deleting}
						onclick={() => deleteSet(set.id ?? '')}
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
						Delete set
					</button>
				{/if}
			</div>
			{#if deleteError}
				<p class="mt-2 text-sm" style="color: var(--danger)">{deleteError}</p>
			{/if}
		{/if}
	{:else if modal.mode === 'create'}
		<KeycapSetForm
			{saving}
			error={saveError}
			onSubmit={handleCreate}
			onCancel={closeModal}
			bind:dirty={formDirty}
		/>
	{:else if modal.mode === 'edit'}
		{@const set = modal.set}
		<KeycapSetForm
			initial={set}
			{saving}
			error={saveError}
			onSubmit={(input) => handleUpdate(set.id ?? '', input)}
			onCancel={() => {
				modal = { mode: 'view', set };
				formDirty = false;
			}}
			bind:dirty={formDirty}
		/>
	{/if}
</Modal>

<svelte:window
	onkeydown={kitModal.mode === 'view' && !kitImageViewerOpen ? handleKitNavKeydown : undefined}
/>

<Modal
	open={kitModal.mode !== 'closed'}
	onClose={closeKitModal}
	wide={kitModal.mode === 'view'}
	obscured={kitImageViewerOpen}
	dirty={kitFormDirty}
>
	{#snippet headerExtra()}
		{#if kitModal.mode === 'view' && hasMultipleKits}
			<button type="button" class="btn-icon" aria-label="Previous kit" onclick={() => stepKit(-1)}>
				←
			</button>
			<button type="button" class="btn-icon" aria-label="Next kit" onclick={() => stepKit(1)}>
				→
			</button>
		{/if}
	{/snippet}

	{#if kitModal.mode === 'create'}
		<KeycapKitForm
			saving={kitSaving}
			error={kitSaveError}
			onSubmit={handleCreateKit}
			onCancel={closeKitModal}
			bind:dirty={kitFormDirty}
		/>
	{:else if kitModal.mode === 'view' && activeKit}
		{@const kit = activeKit}
		{@const imageFailed = failedImages.has(kit.kitId)}
		<KeycapKitDetails
			name={kit.name}
			imageUrl={kit.image?.url}
			{imageFailed}
			onImageError={() => failedImages.add(kit.kitId)}
			onImageClick={() => (kitImageViewerOpen = true)}
			purchase={kit.purchase}
			{currency}
			{showPrice}
		/>

		{#if userContext.isOwnProfile}
			<div
				class="mt-6 flex flex-wrap items-center gap-2 border-t pt-4"
				style="border-color: var(--border)"
			>
				<button type="button" class="btn" onclick={() => openEditKit(kit.kitId)}>Edit kit</button>
				{#if kitBlockingBuilds}
					<span class="text-sm" style="color: var(--danger)">
						Used in: {kitBlockingBuilds.join(', ')}.
					</span>
					<button
						type="button"
						class="btn"
						disabled={kitDeleting}
						onclick={() => deleteKit(kit.kitId, 'detach')}
					>
						{kitDeleting ? 'Removing…' : 'Remove from builds & delete'}
					</button>
					<button
						type="button"
						class="btn"
						disabled={kitDeleting}
						onclick={() => (kitBlockingBuilds = null)}
					>
						Cancel
					</button>
				{:else if confirmingKitDelete === kit.kitId}
					<span class="text-sm">Delete "{kit.name}"?</span>
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						disabled={kitDeleting}
						onclick={() => deleteKit(kit.kitId)}
					>
						{kitDeleting ? 'Deleting…' : 'Confirm delete'}
					</button>
					<button
						type="button"
						class="btn"
						disabled={kitDeleting}
						onclick={() => (confirmingKitDelete = null)}
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						onclick={() => (confirmingKitDelete = kit.kitId)}
					>
						Delete kit
					</button>
				{/if}
			</div>
			{#if kitDeleteError}
				<p class="mt-2 text-sm" style="color: var(--danger)">{kitDeleteError}</p>
			{/if}
		{/if}
	{:else if kitModal.mode === 'edit' && activeKit}
		{@const kit = activeKit}
		<KeycapKitForm
			initial={kit}
			saving={kitSaving}
			error={kitSaveError}
			onSubmit={(input) => handleUpdateKit(kit.kitId, input)}
			onCancel={() => {
				kitModal = { mode: 'view', kitId: kit.kitId };
				kitFormDirty = false;
			}}
			onImageUpload={(file) => handleKitImageUpload(kit.kitId, file)}
			onImageRemove={() => handleKitImageRemove(kit.kitId)}
			bind:dirty={kitFormDirty}
		/>
	{/if}
</Modal>

{#if kitModal.mode === 'view' && activeKit?.image?.url}
	{@const kit = activeKit}
	<ImageViewer
		open={kitImageViewerOpen}
		src={kit.image?.url ?? ''}
		alt={kit.name}
		onClose={() => (kitImageViewerOpen = false)}
		onPrev={hasMultipleKits ? () => stepKit(-1) : undefined}
		onNext={hasMultipleKits ? () => stepKit(1) : undefined}
	/>
{/if}
