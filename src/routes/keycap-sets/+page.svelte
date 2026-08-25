<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { KeycapKit, KeycapSet } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keycapSetsApi } from '$lib/api/client';
	import { orderStatusClass } from '$lib/format';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import KeycapKitDetails from '$lib/components/KeycapKitDetails.svelte';

	let selectedSet = $state<KeycapSet | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let failedImages = new SvelteSet<string>();
	let selectedKit = $state<KeycapKit | null>(null);
	let viewerOpen = $state(false);

	async function openSet(keycapSetId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		detailError = null;
		detailLoading = true;
		selectedSet = null;
		try {
			selectedSet = await keycapSetsApi.getKeycapSet({ userId, keycapSetId });
		} catch {
			detailError = 'Could not load this keycap set.';
		} finally {
			detailLoading = false;
		}
	}

	function closeModal() {
		selectedSet = null;
		detailError = null;
		detailLoading = false;
		selectedKit = null;
		viewerOpen = false;
	}

	function stepKit(delta: 1 | -1) {
		const kits = selectedSet?.kits;
		if (!kits || kits.length < 2 || !selectedKit) return;
		const index = kits.findIndex((kit) => kit.kitId === selectedKit?.kitId);
		if (index === -1) return;
		selectedKit = kits[(index + delta + kits.length) % kits.length];
	}

	function handleKitNavKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') stepKit(-1);
		else if (event.key === 'ArrowRight') stepKit(1);
	}

	let hasMultipleKits = $derived((selectedSet?.kits?.length ?? 0) > 1);
</script>

<svelte:window onkeydown={selectedKit && !viewerOpen ? handleKitNavKeydown : undefined} />

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		keycapSetsApi.listKeycapSets({ userId, cursor })}
	itemKey={(set) => set.id ?? ''}
	emptyMessage="No keycap sets yet."
	getName={(set) => set.name}
	sortOptions={[
		{ label: 'Name', getValue: (set) => set.name },
		{ label: 'Brand', getValue: (set) => set.brand },
		{ label: 'Order status', getValue: (set) => set.orderStatus ?? undefined }
	]}
>
	{#snippet card(set)}
		{@const imageFailed = failedImages.has(set.id ?? '')}
		<button
			type="button"
			class="kc-card relative flex w-full items-center gap-3 overflow-hidden p-3 text-left"
			onclick={() => openSet(set.id ?? '')}
		>
			{#if set.orderStatus}
				<span class="status-badge absolute top-3 right-3 {orderStatusClass(set.orderStatus)}">
					{set.orderStatus}
				</span>
			{/if}
			{#if set.primaryKitImage?.url && !imageFailed}
				<img
					src={set.primaryKitImage.url}
					alt={set.name}
					class="kc-thumb h-16 w-16 shrink-0 object-contain"
					onerror={() => failedImages.add(set.id ?? '')}
				/>
			{/if}
			<div class="pr-4">
				<h2 class="heading-lg text-lg">{set.name}</h2>
				<p class="text-muted text-sm">{set.brand}</p>
				{#if set.profile}
					<p class="text-faint font-mono text-xs">{set.profile}</p>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={detailLoading || detailError !== null || selectedSet !== null}
	onClose={closeModal}
	obscured={selectedKit !== null}
>
	{#if detailLoading}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{detailError}</p>
	{:else if selectedSet}
		<div class="pr-8">
			<h2 class="heading-lg text-2xl">{selectedSet.name}</h2>
			<p class="text-muted">{selectedSet.brand}</p>
			<p class="text-faint mt-1 font-mono text-sm">
				{[selectedSet.profile, selectedSet.material].filter(Boolean).join(' · ')}
			</p>
			{#if selectedSet.notes}
				<p class="text-muted mt-2 text-sm">{selectedSet.notes}</p>
			{/if}
		</div>

		{#if selectedSet.kits && selectedSet.kits.length > 0}
			<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each selectedSet.kits as kit (kit.kitId)}
					{@const imageFailed = failedImages.has(kit.kitId)}
					<button
						type="button"
						class="kc-card w-full overflow-hidden p-3 text-left"
						onclick={() => (selectedKit = kit)}
					>
						{#if kit.image?.url && !imageFailed}
							<img
								src={kit.image.url}
								alt={kit.name}
								class="kc-thumb-tile aspect-square w-full object-contain"
								onerror={() => failedImages.add(kit.kitId)}
							/>
						{:else}
							<div
								class="kc-thumb-tile text-faint flex aspect-square w-full items-center justify-center text-sm"
							>
								No image
							</div>
						{/if}
						<div class="mt-2 flex items-center justify-between gap-2 pr-1">
							<h3 class="font-semibold">{kit.name}</h3>
							{#if kit.purchase?.orderStatus}
								<span class="status-badge shrink-0 {orderStatusClass(kit.purchase.orderStatus)}">
									{kit.purchase.orderStatus}
								</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<p class="text-muted mt-6 text-sm">No kits recorded for this set.</p>
		{/if}
	{/if}
</Modal>

<Modal open={selectedKit !== null} onClose={() => (selectedKit = null)} wide obscured={viewerOpen}>
	{#snippet headerExtra()}
		{#if hasMultipleKits}
			<button type="button" class="btn-icon" aria-label="Previous kit" onclick={() => stepKit(-1)}>
				←
			</button>
			<button type="button" class="btn-icon" aria-label="Next kit" onclick={() => stepKit(1)}>
				→
			</button>
		{/if}
	{/snippet}
	{#if selectedKit}
		{@const kit = selectedKit}
		{@const imageFailed = failedImages.has(kit.kitId)}
		<KeycapKitDetails
			name={kit.name}
			imageUrl={kit.image?.url}
			{imageFailed}
			onImageError={() => failedImages.add(kit.kitId)}
			onImageClick={() => (viewerOpen = true)}
			purchase={kit.purchase}
		/>
	{/if}
</Modal>

{#if selectedKit?.image?.url}
	<ImageViewer
		open={viewerOpen}
		src={selectedKit.image.url}
		alt={selectedKit.name}
		onClose={() => (viewerOpen = false)}
		onPrev={(selectedSet?.kits?.length ?? 0) > 1 ? () => stepKit(-1) : undefined}
		onNext={(selectedSet?.kits?.length ?? 0) > 1 ? () => stepKit(1) : undefined}
	/>
{/if}
