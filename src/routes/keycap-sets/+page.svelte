<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { KeycapKit, KeycapSet } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keycapSetsApi } from '$lib/api/client';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';

	const orderStatusColors: Record<string, string> = {
		ordered: 'preset-filled-warning-500',
		shipped: 'preset-filled-tertiary-500',
		delivered: 'preset-filled-success-500',
		sold: 'preset-filled-surface-500'
	};

	function orderStatusClass(status: string) {
		return orderStatusColors[status.toLowerCase()] ?? 'preset-filled-primary-500';
	}

	let selectedSet = $state<KeycapSet | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let failedImages = new SvelteSet<string>();
	let selectedKit = $state<KeycapKit | null>(null);

	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});

	function formatDate(date: Date | undefined): string | undefined {
		return date ? dateFormatter.format(date) : undefined;
	}

	function formatPrice(price: number | undefined): string | undefined {
		return price != null ? `$${price.toFixed(2)}` : undefined;
	}

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
	}
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		keycapSetsApi.listKeycapSets({ userId, cursor })}
	itemKey={(set) => set.id ?? ''}
	emptyMessage="No keycap sets yet."
>
	{#snippet card(set)}
		<button
			type="button"
			class="w-full card preset-tonal p-4 text-left"
			onclick={() => openSet(set.id ?? '')}
		>
			<h2 class="text-lg font-bold">{set.name}</h2>
			<p class="text-sm opacity-75">{set.brand}</p>
			{#if set.profile}
				<p class="text-sm">{set.profile}</p>
			{/if}
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

<Modal open={selectedKit !== null} onClose={() => (selectedKit = null)} wide>
	{#if selectedKit}
		{@const kit = selectedKit}
		{@const imageFailed = failedImages.has(kit.kitId)}
		<div class="grid grid-cols-1 gap-6 pr-8 sm:grid-cols-2">
			{#if kit.image?.url && !imageFailed}
				<img
					src={kit.image.url}
					alt={kit.name}
					class="max-h-[70vh] w-full rounded bg-white object-contain"
					onerror={() => failedImages.add(kit.kitId)}
				/>
			{:else}
				<div
					class="flex aspect-square w-full items-center justify-center rounded bg-surface-500/10 text-sm opacity-50"
				>
					No image
				</div>
			{/if}
			<div>
				<h2 class="text-2xl font-bold">{kit.name}</h2>
				{#if kit.purchase?.orderStatus}
					<span class="mt-2 badge {orderStatusClass(kit.purchase.orderStatus)}">
						{kit.purchase.orderStatus}
					</span>
				{/if}
				<dl class="mt-4 space-y-2 text-sm">
					{#if kit.purchase?.vendor}
						<div class="flex justify-between gap-4">
							<dt class="opacity-75">Vendor</dt>
							<dd>{kit.purchase.vendor}</dd>
						</div>
					{/if}
					{#if formatPrice(kit.purchase?.price)}
						<div class="flex justify-between gap-4">
							<dt class="opacity-75">Price</dt>
							<dd>{formatPrice(kit.purchase?.price)}</dd>
						</div>
					{/if}
					{#if formatDate(kit.purchase?.orderDate)}
						<div class="flex justify-between gap-4">
							<dt class="opacity-75">Ordered</dt>
							<dd>{formatDate(kit.purchase?.orderDate)}</dd>
						</div>
					{/if}
					{#if formatDate(kit.purchase?.deliveryDate)}
						<div class="flex justify-between gap-4">
							<dt class="opacity-75">Delivered</dt>
							<dd>{formatDate(kit.purchase?.deliveryDate)}</dd>
						</div>
					{/if}
				</dl>
			</div>
		</div>
	{/if}
</Modal>
