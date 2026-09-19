<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	type Page = { items?: T[]; nextCursor?: string | null };
	type SortOption = { label: string; getValue: (item: T) => string | number | undefined };

	const STATUS_FILTERS = [
		'all',
		'planned',
		'ordered',
		'shipped',
		'delivered',
		'cancelled'
	] as const;
	type StatusFilter = (typeof STATUS_FILTERS)[number];

	let {
		userId,
		fetchPage,
		itemKey,
		emptyMessage,
		sortOptions,
		getName,
		getOrderStatus,
		onAdd,
		addLabel,
		card
	}: {
		userId: string;
		fetchPage: (userId: string, cursor: string | undefined) => Promise<Page>;
		itemKey: (item: T) => string;
		emptyMessage: string;
		sortOptions: SortOption[];
		getName: (item: T) => string | undefined;
		getOrderStatus?: (item: T) => string | undefined;
		// Shows a "+" icon button in the sort/filter row, next to the filter
		// button, instead of the page rendering its own separate "+ Add X"
		// button above the grid. Both omitted (rather than just checking
		// onAdd) when the viewer can't add items, e.g. someone else's profile.
		onAdd?: () => void;
		addLabel?: string;
		card: Snippet<[T]>;
	} = $props();

	let statusFilter = $state<StatusFilter>('all');

	// Mobile-only dropdown standing in for the segmented control, which
	// doesn't fit that viewport. A native <select> would work but its
	// option list is unstyled OS chrome, clashing with the rest of the
	// app -- this reuses the same trigger+panel pattern as ProfileMenu.
	let statusMenuOpen = $state(false);
	let statusMenuEl = $state<HTMLDivElement | null>(null);

	function closeStatusMenuOnOutsideClick(event: MouseEvent) {
		if (statusMenuOpen && statusMenuEl && !statusMenuEl.contains(event.target as Node)) {
			statusMenuOpen = false;
		}
	}

	function closeStatusMenuOnEscape(event: KeyboardEvent) {
		if (event.key === 'Escape') statusMenuOpen = false;
	}

	function statusLabel(filter: StatusFilter) {
		return filter === 'all' ? 'All statuses' : filter;
	}

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

	let statusFilteredItems = $derived.by(() => {
		if (!getOrderStatus || statusFilter === 'all') return items;
		return items.filter((item) => (getOrderStatus(item) ?? '').toLowerCase() === statusFilter);
	});

	let filteredItems = $derived.by(() => {
		const needle = filterText.trim().toLowerCase();
		if (!needle) return statusFilteredItems;
		return statusFilteredItems.filter((item) => matchesFilter(item, needle));
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

	// Guards against a stale load() overwriting a newer one's result if the
	// effect below fires again (e.g. userId settling after the profile
	// loads) while a previous call is still paginating through fetchPage.
	let loadToken = 0;

	async function load() {
		if (!userId) return;

		const token = ++loadToken;
		loadError = null;
		loading = true;
		try {
			const allItems: T[] = [];
			let cursor: string | undefined;
			do {
				const page = await fetchPage(userId, cursor);
				if (token !== loadToken) return;
				allItems.push(...(page.items ?? []));
				cursor = page.nextCursor ?? undefined;
			} while (cursor);
			if (token !== loadToken) return;
			items = allItems;
		} catch {
			if (token !== loadToken) return;
			loadError = 'Could not load this collection.';
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	// Exposed so parent pages can refresh data after a create/update/delete
	// without remounting this component, which would otherwise reset the
	// user's status filter, sort, and search state.
	export async function refresh() {
		await load();
	}

	$effect(() => {
		load();
	});
</script>

<svelte:window
	onclick={statusMenuOpen ? closeStatusMenuOnOutsideClick : undefined}
	onkeydown={statusMenuOpen ? closeStatusMenuOnEscape : undefined}
/>

{#if loading}
	<div class="flex items-center justify-center p-16">
		<p class="text-muted font-mono text-sm tracking-wide">Loading&hellip;</p>
	</div>
{:else if loadError}
	<div class="flex items-center justify-center p-16">
		<p class="text-lg" style="color: var(--danger)">{loadError}</p>
	</div>
{:else}
	{#if getOrderStatus}
		<div class="mt-4 hidden justify-center sm:flex">
			<div class="segmented-control" role="group" aria-label="Filter by order status">
				{#each STATUS_FILTERS as filter (filter)}
					<button
						type="button"
						class="segmented-control-btn"
						class:segmented-control-btn-active={statusFilter === filter}
						aria-pressed={statusFilter === filter}
						onclick={() => (statusFilter = filter)}
					>
						{filter}
					</button>
				{/each}
			</div>
		</div>
		<div class="relative mt-4 px-4 sm:hidden" bind:this={statusMenuEl}>
			<button
				type="button"
				class="field-select flex w-full items-center justify-between font-mono text-xs uppercase"
				aria-haspopup="menu"
				aria-expanded={statusMenuOpen}
				onclick={() => (statusMenuOpen = !statusMenuOpen)}
			>
				{statusLabel(statusFilter)}
			</button>
			{#if statusMenuOpen}
				<div class="profile-menu" style="width: 100%" role="menu">
					{#each STATUS_FILTERS as filter (filter)}
						<button
							type="button"
							class="profile-menu-item font-mono text-xs uppercase"
							class:profile-menu-item-active={statusFilter === filter}
							role="menuitem"
							onclick={() => {
								statusFilter = filter;
								statusMenuOpen = false;
							}}
						>
							{statusLabel(filter)}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
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
		{#if onAdd}
			<button
				type="button"
				class="btn-icon btn-accent"
				aria-label={addLabel ?? 'Add'}
				onclick={onAdd}
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
					<path d="M12 5v14" />
					<path d="M5 12h14" />
				</svg>
			</button>
		{/if}
	</div>
	{#if sortedItems.length === 0}
		<div class="flex items-center justify-center p-16">
			<p class="text-muted text-xl font-semibold">
				{items.length === 0 ? emptyMessage : 'No matches.'}
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each sortedItems as item (itemKey(item))}
				{@render card(item)}
			{/each}
		</div>
	{/if}
{/if}
