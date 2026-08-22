<script lang="ts">
	import type { Switch as SwitchModel } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { switchesApi } from '$lib/api/client';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';

	let selectedSwitch = $state<SwitchModel | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);

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
		<button
			type="button"
			class="w-full card preset-tonal p-4 text-left"
			onclick={() => openSwitch(sw.id ?? '')}
		>
			<h2 class="text-lg font-bold">{sw.name}</h2>
			<p class="text-sm opacity-75">{sw.brand}</p>
			{#if sw.type}
				<p class="text-sm">{sw.type}</p>
			{/if}
		</button>
	{/snippet}
</CollectionGrid>

<Modal open={detailLoading || detailError !== null || selectedSwitch !== null} onClose={closeModal}>
	{#if detailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg text-error-500">{detailError}</p>
	{:else if selectedSwitch}
		<SwitchDetails sw={selectedSwitch} />
	{/if}
</Modal>
