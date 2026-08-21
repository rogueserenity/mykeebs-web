<script lang="ts">
	import { keyboardsApi } from '$lib/api/client';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';

	const orderStatusColors: Record<string, string> = {
		ordered: 'preset-filled-warning-500',
		shipped: 'preset-filled-tertiary-500',
		delivered: 'preset-filled-success-500',
		sold: 'preset-filled-surface-500'
	};

	function orderStatusClass(status: string) {
		return orderStatusColors[status.toLowerCase()] ?? 'preset-filled-primary-500';
	}
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		keyboardsApi.listKeyboards({ userId, cursor })}
	itemKey={(keyboard) => keyboard.id ?? ''}
	emptyMessage="No keyboards yet."
>
	{#snippet card(keyboard)}
		<div class="relative card preset-tonal p-4">
			{#if keyboard.orderStatus}
				<span class="absolute top-4 right-4 badge {orderStatusClass(keyboard.orderStatus)}">
					{keyboard.orderStatus}
				</span>
			{/if}
			<h2 class="pr-4 text-lg font-bold">{keyboard.name}</h2>
			<p class="text-sm opacity-75">{keyboard.brand}</p>
			{#if keyboard.size || keyboard.layout}
				<p class="text-sm">{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}</p>
			{/if}
		</div>
	{/snippet}
</CollectionGrid>
