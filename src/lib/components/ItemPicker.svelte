<script lang="ts" module>
	// Holds a picker's fetched collection across opens of the same logical
	// picker -- ItemPicker fully unmounts when its host closes it (an
	// {#if}), so without a cache passed in from the parent, reopening the
	// same picker re-fetches the user's entire collection (paginated,
	// including presigned image URLs for every item) from scratch every
	// time. Left undefined for a one-off picker that doesn't need this.
	export type ItemPickerCache<T> = { items: T[] | null };
</script>

<script lang="ts" generics="T">
	let {
		userId,
		fetchPage,
		itemKey,
		getLabel,
		getSublabel,
		getImageUrl,
		placeholder = 'Search…',
		onPick,
		onCancel,
		cache
	}: {
		userId: string;
		fetchPage: (
			userId: string,
			cursor: string | undefined
		) => Promise<{
			items?: T[];
			nextCursor?: string | null;
		}>;
		itemKey: (item: T) => string;
		getLabel: (item: T) => string | undefined;
		getSublabel?: (item: T) => string | undefined;
		getImageUrl?: (item: T) => string | undefined;
		placeholder?: string;
		onPick: (item: T) => void;
		// Optional: lets Escape dismiss the picker (from the search box) the
		// same way a visible Cancel/Done button would, instead of doing
		// nothing once the filter text is already empty.
		onCancel?: () => void;
		cache?: ItemPickerCache<T>;
	} = $props();

	let items = $state<T[]>(cache?.items ?? []);
	let loading = $state(cache?.items == null);
	let loadError = $state<string | null>(null);
	let filterText = $state('');
	let searchInput = $state<HTMLInputElement | null>(null);
	let listEl = $state<HTMLDivElement | null>(null);

	// Runs once per mount of this component instance -- covers both a
	// picker opening inside an already-open Modal (Modal's own open-effect
	// only fires when the Modal itself opens, not on this) and the Modal's
	// own autofocus picking this up via data-autofocus when the picker is
	// what the Modal opens showing.
	$effect(() => {
		searchInput?.focus();
	});

	let filteredItems = $derived.by(() => {
		const needle = filterText.trim().toLowerCase();
		if (!needle) return items;
		return items.filter((item) => {
			const label = getLabel(item)?.toLowerCase() ?? '';
			const sublabel = getSublabel?.(item)?.toLowerCase() ?? '';
			return label.includes(needle) || sublabel.includes(needle);
		});
	});

	// The keyboard-highlighted row, driven by Arrow/Home/End on the search
	// box below -- a plain text input gives no arrow-key behavior on its
	// own, so this recreates the standard combobox-listbox pattern by
	// hand: arrows move a highlighted index, Enter picks it.
	let activeIndex = $state(0);

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track filteredItems so a new filter always re-clamps
		filteredItems;
		activeIndex = 0;
	});

	function clampIndex(index: number): number {
		if (filteredItems.length === 0) return 0;
		return Math.max(0, Math.min(index, filteredItems.length - 1));
	}

	function scrollActiveIntoView() {
		listEl
			?.querySelector<HTMLElement>('[data-active="true"]')
			?.scrollIntoView({ block: 'nearest' });
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				activeIndex = clampIndex(activeIndex + 1);
				scrollActiveIntoView();
				break;
			case 'ArrowUp':
				event.preventDefault();
				activeIndex = clampIndex(activeIndex - 1);
				scrollActiveIntoView();
				break;
			case 'Home':
				event.preventDefault();
				activeIndex = 0;
				scrollActiveIntoView();
				break;
			case 'End':
				event.preventDefault();
				activeIndex = clampIndex(filteredItems.length - 1);
				scrollActiveIntoView();
				break;
			case 'Enter':
				event.preventDefault();
				if (filteredItems[activeIndex]) onPick(filteredItems[activeIndex]);
				break;
			case 'Escape':
				if (filterText) {
					event.preventDefault();
					filterText = '';
				} else if (onCancel) {
					event.preventDefault();
					onCancel();
				}
				break;
		}
	}

	$effect(() => {
		if (!userId) return;
		if (cache?.items) {
			// Already fetched by an earlier open of this same picker --
			// reuse it instead of re-fetching the whole collection (with a
			// fresh presigned image URL per item) again.
			items = cache.items;
			loading = false;
			return;
		}

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
			if (cache) cache.items = allItems;
		})()
			.catch(() => {
				loadError = 'Could not load this collection.';
			})
			.finally(() => {
				loading = false;
			});
	});
</script>

<div class="flex flex-col gap-2">
	<input
		bind:this={searchInput}
		type="search"
		class="field-input"
		{placeholder}
		bind:value={filterText}
		autocomplete="off"
		data-autofocus
		role="combobox"
		aria-expanded="true"
		aria-controls="item-picker-listbox"
		aria-activedescendant={filteredItems[activeIndex]
			? `item-picker-option-${itemKey(filteredItems[activeIndex])}`
			: undefined}
		onkeydown={handleSearchKeydown}
	/>
	<div
		bind:this={listEl}
		id="item-picker-listbox"
		role="listbox"
		class="max-h-64 overflow-y-auto rounded border"
		style="border-color: var(--border)"
	>
		{#if loading}
			<p class="text-muted p-4 text-center text-sm">Loading&hellip;</p>
		{:else if loadError}
			<p class="p-4 text-center text-sm" style="color: var(--danger)">{loadError}</p>
		{:else if filteredItems.length === 0}
			<p class="text-muted p-4 text-center text-sm">No matches.</p>
		{:else}
			{#each filteredItems as item, index (itemKey(item))}
				<button
					id="item-picker-option-{itemKey(item)}"
					type="button"
					role="option"
					aria-selected={index === activeIndex}
					data-active={index === activeIndex}
					class="kc-picker-row flex w-full items-center gap-3 border-b p-2 text-left last:border-b-0"
					class:kc-picker-row-active={index === activeIndex}
					style="border-color: var(--border)"
					onmouseenter={() => (activeIndex = index)}
					onclick={() => onPick(item)}
				>
					{#if getImageUrl?.(item)}
						<img
							src={getImageUrl(item)}
							alt=""
							class="kc-thumb h-10 w-10 shrink-0 object-contain"
						/>
					{/if}
					<div class="min-w-0">
						<p class="truncate text-sm font-medium">{getLabel(item)}</p>
						{#if getSublabel?.(item)}
							<p class="text-muted truncate text-xs">{getSublabel(item)}</p>
						{/if}
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>
