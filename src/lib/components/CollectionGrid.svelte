<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	type Page = { items?: T[]; nextCursor?: string | null };
	type SortOption = { label: string; getValue: (item: T) => string | number | undefined };

	let {
		userId,
		fetchPage,
		itemKey,
		emptyMessage,
		sortOptions,
		getName,
		card
	}: {
		userId: string;
		fetchPage: (userId: string, cursor: string | undefined) => Promise<Page>;
		itemKey: (item: T) => string;
		emptyMessage: string;
		sortOptions: SortOption[];
		getName: (item: T) => string | undefined;
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

	let sortIndex = $state(0);
	let sortDescending = $state(false);

	function compareValues(a: string | number | undefined, b: string | number | undefined): number {
		if (a == null && b == null) return 0;
		if (a == null) return 1;
		if (b == null) return -1;
		if (typeof a === 'number' && typeof b === 'number') return a - b;
		return String(a).localeCompare(String(b));
	}

	let sortedItems = $derived.by(() => {
		const option = sortOptions[sortIndex];
		if (!option) return filteredItems;
		return [...filteredItems].sort((a, b) => {
			const primary = compareValues(option.getValue(a), option.getValue(b));
			if (primary !== 0) return sortDescending ? -primary : primary;
			return compareValues(getName(a), getName(b));
		});
	});

	$effect(() => {
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
				loadError = 'Could not load this collection.';
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

{#if loading}
	<div class="flex items-center justify-center p-16">
		<p class="text-muted font-mono text-sm tracking-wide">Loading&hellip;</p>
	</div>
{:else if loadError}
	<div class="flex items-center justify-center p-16">
		<p class="text-lg" style="color: var(--danger)">{loadError}</p>
	</div>
{:else if items.length === 0}
	<div class="flex items-center justify-center p-16">
		<p class="text-muted text-xl font-semibold">{emptyMessage}</p>
	</div>
{:else}
	<div class="flex items-center justify-end gap-2 p-4 pb-0">
		{#if sortOptions.length > 0}
			<select class="field-select w-auto" bind:value={sortIndex}>
				{#each sortOptions as option, index (option.label)}
					<option value={index}>Sort: {option.label}</option>
				{/each}
			</select>
			<button
				type="button"
				class="btn-icon"
				aria-label={sortDescending ? 'Sort ascending' : 'Sort descending'}
				onclick={() => (sortDescending = !sortDescending)}
			>
				{sortDescending ? '↓' : '↑'}
			</button>
		{/if}
		{#if filterExpanded}
			<input
				bind:this={filterInput}
				type="search"
				class="field-input w-64"
				placeholder="Filter…"
				bind:value={filterText}
				onblur={collapseFilterIfEmpty}
				onkeydown={handleFilterKeydown}
			/>
		{:else}
			<button type="button" class="btn-icon" aria-label="Filter" onclick={expandFilter}>
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
	{#if sortedItems.length === 0}
		<div class="flex items-center justify-center p-16">
			<p class="text-muted text-xl font-semibold">No matches.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each sortedItems as item (itemKey(item))}
				{@render card(item)}
			{/each}
		</div>
	{/if}
{/if}
