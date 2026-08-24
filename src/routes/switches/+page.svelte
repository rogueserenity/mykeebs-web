<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Switch as SwitchModel } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { switchesApi } from '$lib/api/client';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';

	let selectedSwitch = $state<SwitchModel | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let failedImages = new SvelteSet<string>();
	let viewerOpen = $state(false);

	async function openSwitch(switchId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		detailError = null;
		detailLoading = true;
		selectedSwitch = null;
		try {
			selectedSwitch = await switchesApi.getSwitch({ userId, switchId });
		} catch {
			detailError = 'Could not load this switch.';
		} finally {
			detailLoading = false;
		}
	}

	function closeModal() {
		selectedSwitch = null;
		detailError = null;
		detailLoading = false;
		viewerOpen = false;
	}
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		switchesApi.listSwitches({ userId, cursor })}
	itemKey={(sw) => sw.id ?? ''}
	emptyMessage="No switches yet."
	getName={(sw) => sw.name}
	sortOptions={[
		{ label: 'Name', getValue: (sw) => sw.name },
		{ label: 'Brand', getValue: (sw) => sw.brand }
	]}
>
	{#snippet card(sw)}
		{@const imageFailed = failedImages.has(sw.id ?? '')}
		<button
			type="button"
			class="flex w-full items-center gap-3 card preset-tonal p-4 text-left"
			onclick={() => openSwitch(sw.id ?? '')}
		>
			{#if sw.image?.url && !imageFailed}
				<img
					src={sw.image.url}
					alt={sw.name}
					class="h-16 w-16 shrink-0 rounded object-contain"
					onerror={() => failedImages.add(sw.id ?? '')}
				/>
			{/if}
			<div>
				<h2 class="text-lg font-bold">{sw.name}</h2>
				<p class="text-sm opacity-75">{sw.brand}</p>
				{#if sw.type}
					<p class="text-sm">{sw.type}</p>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={detailLoading || detailError !== null || selectedSwitch !== null}
	onClose={closeModal}
	obscured={viewerOpen}
>
	{#if detailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg text-error-500">{detailError}</p>
	{:else if selectedSwitch}
		<SwitchDetails sw={selectedSwitch} onImageClick={() => (viewerOpen = true)} />
	{/if}
</Modal>

{#if selectedSwitch?.image?.url}
	<ImageViewer
		open={viewerOpen}
		src={selectedSwitch.image.url}
		alt={selectedSwitch.name}
		onClose={() => (viewerOpen = false)}
	/>
{/if}
