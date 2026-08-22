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
	let loading = $state(true);
	let loadError = $state<string | null>(null);
	let filterText = $state('');
	let filterExpanded = $state(false);
	let filterInput = $state<HTMLInputElement | null>(null);

	function expandFilter() {
		filterExpanded = true;
		requestAnimationFrame(() => filterInput?.focus());
	}

	function collapseFilterIfEmpty() {
		if (!filterText) filterExpanded = false;
	}

	function handleFilterKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			filterText = '';
			filterExpanded = false;
			filterInput?.blur();
		}
	}

	function valueMatchesFilter(value: unknown, needle: string): boolean {
		if (typeof value === 'string') {
			return value.toLowerCase().includes(needle);
		}
		if (value != null && typeof value === 'object' && !(value instanceof Date)) {
			return Object.values(value).some(
				(nested) => typeof nested === 'string' && nested.toLowerCase().includes(needle)
			);
		}
		return false;
	}

	function matchesFilter(item: T, needle: string): boolean {
		return Object.entries(item as Record<string, unknown>).some(
			([key, value]) => key !== 'id' && valueMatchesFilter(value, needle)
		);
	}

	let filteredItems = $derived.by(() => {
		const needle = filterText.trim().toLowerCase();
		if (!needle) return items;
		return items.filter((item) => matchesFilter(item, needle));
	});

	$effect(() => {
		const userId = auth.user?.id;
		if (!userId) return;

		loadError = null;
		loading = true;
		(async () => {
			const allItems: T[] = [];
			let cursor: string | undefined;
			do {
				const page = await fetchPage(userId, cursor);
				allItems.push(...(page.items ?? []));
				cursor = page.nextCursor ?? undefined;
			} while (cursor);
			items = allItems;
		})()
			.catch(() => {
				loadError = 'Could not load your collection.';
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

{#if auth.status === 'loading' || loading}
	<div class="flex items-center justify-center p-16">
		<p class="text-lg opacity-75">Loading&hellip;</p>
	</div>
{:else if auth.status === 'signed-out'}
	<div class="flex items-center justify-center p-16">
		<p class="text-lg opacity-75">Sign in to see your collection.</p>
	</div>
{:else if loadError}
	<div class="flex items-center justify-center p-16">
		<p class="text-lg text-error-500">{loadError}</p>
	</div>
{:else if items.length === 0}
	<div class="flex items-center justify-center p-16">
		<p class="text-xl font-semibold opacity-75">{emptyMessage}</p>
	</div>
{:else}
	<div class="flex justify-end p-4 pb-0">
		{#if filterExpanded}
			<input
				bind:this={filterInput}
				type="search"
				class="input w-64"
				placeholder="Filter…"
				bind:value={filterText}
				onblur={collapseFilterIfEmpty}
				onkeydown={handleFilterKeydown}
			/>
		{:else}
			<button
				type="button"
				class="btn-icon preset-tonal"
				aria-label="Filter"
				onclick={expandFilter}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="mx-auto h-5 w-5"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="m21 21-4.3-4.3" />
				</svg>
			</button>
		{/if}
	</div>
	{#if filteredItems.length === 0}
		<div class="flex items-center justify-center p-16">
			<p class="text-xl font-semibold opacity-75">No matches.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredItems as item (itemKey(item))}
				{@render card(item)}
			{/each}
		</div>
	{/if}
{/if}
