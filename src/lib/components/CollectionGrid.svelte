<script lang="ts" generics="T">
	import { auth } from '$lib/auth/auth.svelte';
	import type { Snippet } from 'svelte';

	type Page = { items?: T[]; nextCursor?: string | null };

	let {
		fetchPage,
		itemKey,
		emptyMessage,
		card
	}: {
		fetchPage: (userId: string, cursor: string | undefined) => Promise<Page>;
		itemKey: (item: T) => string;
		emptyMessage: string;
		card: Snippet<[T]>;
	} = $props();

	let items = $state<T[]>([]);
	let loadError = $state<string | null>(null);

	$effect(() => {
		const userId = auth.user?.id;
		if (!userId) return;

		loadError = null;
		(async () => {
			const allItems: T[] = [];
			let cursor: string | undefined;
			do {
				const page = await fetchPage(userId, cursor);
				allItems.push(...(page.items ?? []));
				cursor = page.nextCursor ?? undefined;
			} while (cursor);
			items = allItems;
		})().catch(() => {
			loadError = 'Could not load your collection.';
		});
	});
</script>

{#if auth.status === 'loading'}
	<p class="p-4">Loading&hellip;</p>
{:else if auth.status === 'signed-out'}
	<p class="p-4">Sign in to see your collection.</p>
{:else if loadError}
	<p class="p-4 text-error-500">{loadError}</p>
{:else if items.length === 0}
	<p class="p-4">{emptyMessage}</p>
{:else}
	<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each items as item (itemKey(item))}
			{@render card(item)}
		{/each}
	</div>
{/if}
