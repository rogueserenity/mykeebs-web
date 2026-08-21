<script lang="ts">
	import { keycapSetsApi } from '$lib/api/client';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		keycapSetsApi.listKeycapSets({ userId, cursor })}
	itemKey={(set) => set.id ?? ''}
	emptyMessage="No keycap sets yet."
>
	{#snippet card(set)}
		<div class="card preset-tonal p-4">
			<h2 class="text-lg font-bold">{set.name}</h2>
			<p class="text-sm opacity-75">{set.brand}</p>
			{#if set.profile}
				<p class="text-sm">{set.profile}</p>
			{/if}
		</div>
	{/snippet}
</CollectionGrid>
