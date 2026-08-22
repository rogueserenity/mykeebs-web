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
</script>

<svelte:window onkeydown={selectedKit ? handleKitNavKeydown : undefined} />

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
			class="relative flex w-full items-center gap-3 overflow-hidden card preset-tonal p-3 text-left"
			onclick={() => openSet(set.id ?? '')}
		>
			{#if set.orderStatus}
				<span class="absolute top-3 right-3 badge {orderStatusClass(set.orderStatus)}">
					{set.orderStatus}
				</span>
			{/if}
			{#if set.primaryKitImage?.url && !imageFailed}
				<img
					src={set.primaryKitImage.url}
					alt={set.name}
					class="h-16 w-16 shrink-0 rounded object-contain"
					onerror={() => failedImages.add(set.id ?? '')}
				/>
			{/if}
			<div class="pr-4">
				<h2 class="text-lg font-bold">{set.name}</h2>
				<p class="text-sm opacity-75">{set.brand}</p>
				{#if set.profile}
					<p class="text-sm">{set.profile}</p>
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
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg text-error-500">{detailError}</p>
	{:else if selectedSet}
		<div class="pr-8">
			<h2 class="text-2xl font-bold">{selectedSet.name}</h2>
			<p class="opacity-75">{selectedSet.brand}</p>
			<p class="mt-1 text-sm">
				{[selectedSet.profile, selectedSet.material].filter(Boolean).join(' · ')}
			</p>
			{#if selectedSet.notes}
				<p class="mt-2 text-sm opacity-75">{selectedSet.notes}</p>
			{/if}
		</div>

		{#if selectedSet.kits && selectedSet.kits.length > 0}
			<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
				{#each selectedSet.kits as kit (kit.kitId)}
					{@const imageFailed = failedImages.has(kit.kitId)}
					<button
						type="button"
						class="relative w-full overflow-hidden card preset-tonal p-3 text-left"
						onclick={() => (selectedKit = kit)}
					>
						{#if kit.purchase?.orderStatus}
							<span
								class="absolute top-3 right-3 badge {orderStatusClass(kit.purchase.orderStatus)}"
							>
								{kit.purchase.orderStatus}
							</span>
						{/if}
						{#if kit.image?.url && !imageFailed}
							<img
								src={kit.image.url}
								alt={kit.name}
								class="aspect-square w-full rounded bg-white object-contain"
								onerror={() => failedImages.add(kit.kitId)}
							/>
						{:else}
							<div
								class="flex aspect-square w-full items-center justify-center rounded bg-surface-500/10 text-sm opacity-50"
							>
								No image
							</div>
						{/if}
						<h3 class="mt-2 pr-4 font-semibold">{kit.name}</h3>
					</button>
				{/each}
			</div>
		{:else}
			<p class="mt-6 text-sm opacity-75">No kits recorded for this set.</p>
		{/if}
	{/if}
</Modal>

<Modal open={selectedKit !== null} onClose={() => (selectedKit = null)} wide obscured={viewerOpen}>
	{#if selectedKit}
		{@const kit = selectedKit}
		{@const imageFailed = failedImages.has(kit.kitId)}
		{@const hasMultipleKits = (selectedSet?.kits?.length ?? 0) > 1}
		{#if hasMultipleKits}
			<div class="mb-4 flex items-center justify-between pr-8">
				<button
					type="button"
					class="btn-icon preset-tonal"
					aria-label="Previous kit"
					onclick={() => stepKit(-1)}
				>
					←
				</button>
				<span class="text-sm opacity-75">{kit.name}</span>
				<button
					type="button"
					class="btn-icon preset-tonal"
					aria-label="Next kit"
					onclick={() => stepKit(1)}
				>
					→
				</button>
			</div>
		{/if}
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
