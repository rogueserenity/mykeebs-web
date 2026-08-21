<script lang="ts">
	import { switchesApi } from '$lib/api/client';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		switchesApi.listSwitches({ userId, cursor })}
	itemKey={(sw) => sw.id ?? ''}
	emptyMessage="No switches yet."
>
	{#snippet card(sw)}
		<div class="card preset-tonal p-4">
			<h2 class="text-lg font-bold">{sw.name}</h2>
			<p class="text-sm opacity-75">{sw.brand}</p>
			{#if sw.type}
				<p class="text-sm">{sw.type}</p>
			{/if}
		</div>
	{/snippet}
</CollectionGrid>
