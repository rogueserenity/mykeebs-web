<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Keyboard } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keyboardsApi } from '$lib/api/client';
	import { orderStatusClass } from '$lib/format';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import KeyboardDetails from '$lib/components/KeyboardDetails.svelte';

	let selectedKeyboard = $state<Keyboard | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let failedImages = new SvelteSet<string>();
	let galleryViewerOpen = $state(false);
	let galleryIndex = $state(0);

	async function openKeyboard(keyboardId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		detailError = null;
		detailLoading = true;
		selectedKeyboard = null;
		try {
			selectedKeyboard = await keyboardsApi.getKeyboard({ userId, keyboardId });
		} catch {
			detailError = 'Could not load this keyboard.';
		} finally {
			detailLoading = false;
		}
	}

	function closeModal() {
		selectedKeyboard = null;
		detailError = null;
		detailLoading = false;
		galleryViewerOpen = false;
		galleryIndex = 0;
	}
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		keyboardsApi.listKeyboards({ userId, cursor })}
	itemKey={(keyboard) => keyboard.id ?? ''}
	emptyMessage="No keyboards yet."
	getName={(keyboard) => keyboard.name}
	sortOptions={[
		{ label: 'Name', getValue: (keyboard) => keyboard.name },
		{ label: 'Brand', getValue: (keyboard) => keyboard.brand },
		{ label: 'Order status', getValue: (keyboard) => keyboard.orderStatus }
	]}
>
	{#snippet card(keyboard)}
		{@const imageFailed = failedImages.has(keyboard.id ?? '')}
		<button
			type="button"
			class="relative flex w-full items-center gap-3 card preset-tonal p-4 text-left"
			onclick={() => openKeyboard(keyboard.id ?? '')}
		>
			{#if keyboard.orderStatus}
				<span class="absolute top-4 right-4 badge {orderStatusClass(keyboard.orderStatus)}">
					{keyboard.orderStatus}
				</span>
			{/if}
			{#if keyboard.image?.url && !imageFailed}
				<img
					src={keyboard.image.url}
					alt={keyboard.name}
					class="h-16 w-16 shrink-0 rounded object-contain"
					onerror={() => failedImages.add(keyboard.id ?? '')}
				/>
			{/if}
			<div class="pr-4">
				<h2 class="text-lg font-bold">{keyboard.name}</h2>
				<p class="text-sm opacity-75">{keyboard.brand}</p>
				{#if keyboard.size || keyboard.layout}
					<p class="text-sm">{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}</p>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={detailLoading || detailError !== null || selectedKeyboard !== null}
	onClose={closeModal}
	obscured={galleryViewerOpen}
>
	{#if detailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg text-error-500">{detailError}</p>
	{:else if selectedKeyboard}
		<KeyboardDetails
			keyboard={selectedKeyboard}
			onImageClick={(index) => {
				galleryIndex = index;
				galleryViewerOpen = true;
			}}
		/>
	{/if}
</Modal>

{#if selectedKeyboard?.images && selectedKeyboard.images.length > 0}
	<ImageViewer
		open={galleryViewerOpen}
		src={selectedKeyboard.images[galleryIndex].url}
		alt={selectedKeyboard.name}
		onClose={() => (galleryViewerOpen = false)}
		onPrev={selectedKeyboard.images.length > 1
			? () =>
					(galleryIndex =
						(galleryIndex - 1 + selectedKeyboard!.images!.length) %
						selectedKeyboard!.images!.length)
			: undefined}
		onNext={selectedKeyboard.images.length > 1
			? () => (galleryIndex = (galleryIndex + 1) % selectedKeyboard!.images!.length)
			: undefined}
	/>
{/if}
