<script lang="ts">
	import { buildsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import { formatPrice } from '$lib/format';
	import { getUserContext } from '$lib/user-context';
	import { resolve } from '$app/paths';

	const userContext = getUserContext();
	const currency = $derived(userContext.profile.preferences?.currency ?? 'USD');
	// kbdb omits price/totalCost from list responses entirely when this is
	// off, so summing what comes back would otherwise show a misleading
	// $0.00 rather than hiding the total as intended.
	const showPrices = $derived(
		userContext.isOwnProfile && (userContext.profile.preferences?.showPriceToMe ?? true)
	);

	type ItemCounts = { keyboards: number; switches: number; keycapSets: number; builds: number };

	const STATUS_FILTERS = [
		'all',
		'planned',
		'ordered',
		'shipped',
		'delivered',
		'cancelled'
	] as const;
	type StatusFilter = (typeof STATUS_FILTERS)[number];

	let statusFilter = $state<StatusFilter>('all');

	// Mobile-only dropdown standing in for the segmented control, which
	// doesn't fit that viewport -- same trigger+panel pattern as
	// CollectionGrid's own status filter and ProfileMenu.
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

	type ItemEntry = { status: string; price: number | undefined };

	let itemStatuses = $state<{
		keyboards: ItemEntry[];
		switches: ItemEntry[];
		keycapSets: ItemEntry[];
		builds: number;
		buildsTotalCost: number;
	} | null>(null);
	let countsLoading = $state(false);

	async function fetchAll<T>(
		fetchPage: (cursor: string | undefined) => Promise<{
			items?: T[];
			nextCursor?: string | null;
		}>
	): Promise<T[]> {
		const all: T[] = [];
		let cursor: string | undefined;
		do {
			const pageResult = await fetchPage(cursor);
			all.push(...(pageResult.items ?? []));
			cursor = pageResult.nextCursor ?? undefined;
		} while (cursor);
		return all;
	}

	// The API scopes each of these to what the viewer is allowed to see: the
	// owner gets everything, anyone else gets only items shared with them.
	// Builds carry no order status, so only their total count is tracked.
	async function loadCounts(userId: string) {
		countsLoading = true;
		try {
			const [keyboards, switches, keycapSets, builds] = await Promise.all([
				fetchAll<{ orderStatus?: string; price?: number }>((cursor) =>
					keyboardsApi.listKeyboards({ userId, cursor })
				),
				fetchAll<{ orderStatus?: string; price?: number }>((cursor) =>
					switchesApi.listSwitches({ userId, cursor })
				),
				fetchAll<{ orderStatus?: string | null; totalCost?: number }>((cursor) =>
					keycapSetsApi.listKeycapSets({ userId, cursor })
				),
				fetchAll<{ totalCost?: number }>((cursor) => buildsApi.listBuilds({ userId, cursor }))
			]);
			itemStatuses = {
				keyboards: keyboards.map((k) => ({ status: k.orderStatus ?? '', price: k.price })),
				switches: switches.map((s) => ({ status: s.orderStatus ?? '', price: s.price })),
				keycapSets: keycapSets.map((k) => ({ status: k.orderStatus ?? '', price: k.totalCost })),
				builds: builds.length,
				buildsTotalCost: builds.reduce((sum, b) => sum + (b.totalCost ?? 0), 0)
			};
		} catch {
			itemStatuses = null;
		} finally {
			countsLoading = false;
		}
	}

	$effect(() => {
		if (userContext.userId) loadCounts(userContext.userId);
	});

	const profile = $derived(userContext.profile);

	function countFor(entries: ItemEntry[], filter: StatusFilter): number {
		if (filter === 'all') return entries.length;
		return entries.filter((e) => e.status.toLowerCase() === filter).length;
	}

	function priceSumFor(entries: ItemEntry[], filter: StatusFilter): number {
		const matching =
			filter === 'all' ? entries : entries.filter((e) => e.status.toLowerCase() === filter);
		return matching.reduce((sum, e) => sum + (e.price ?? 0), 0);
	}

	const counts = $derived<ItemCounts | null>(
		itemStatuses
			? {
					keyboards: countFor(itemStatuses.keyboards, statusFilter),
					switches: countFor(itemStatuses.switches, statusFilter),
					keycapSets: countFor(itemStatuses.keycapSets, statusFilter),
					builds: statusFilter === 'all' ? itemStatuses.builds : 0
				}
			: null
	);

	type ItemTotals = { keyboards: number; switches: number; keycapSets: number; builds: number };

	const totals = $derived<ItemTotals | null>(
		itemStatuses
			? {
					keyboards: priceSumFor(itemStatuses.keyboards, statusFilter),
					switches: priceSumFor(itemStatuses.switches, statusFilter),
					keycapSets: priceSumFor(itemStatuses.keycapSets, statusFilter),
					builds: statusFilter === 'all' ? itemStatuses.buildsTotalCost : 0
				}
			: null
	);

	const grandTotal = $derived(
		totals ? totals.keyboards + totals.switches + totals.keycapSets : null
	);

	const statTiles = $derived(
		counts
			? [
					{
						label: 'Keyboards',
						value: counts.keyboards,
						price: totals?.keyboards,
						href: resolve('/u/[username]/keyboards', { username: userContext.username })
					},
					{
						label: 'Switches',
						value: counts.switches,
						price: totals?.switches,
						href: resolve('/u/[username]/switches', { username: userContext.username })
					},
					{
						label: 'Keycap Sets',
						value: counts.keycapSets,
						price: totals?.keycapSets,
						href: resolve('/u/[username]/keycap-sets', { username: userContext.username })
					},
					{
						label: 'Builds',
						value: counts.builds,
						price: totals?.builds,
						href: resolve('/u/[username]/builds', { username: userContext.username })
					}
				]
			: []
	);
</script>

<svelte:window
	onclick={statusMenuOpen ? closeStatusMenuOnOutsideClick : undefined}
	onkeydown={statusMenuOpen ? closeStatusMenuOnEscape : undefined}
/>

{#if profile.discordUsername || profile.bio || (profile.links && profile.links.length > 0)}
	<div class="mb-8 flex flex-col gap-5">
		{#if profile.discordUsername}
			<div>
				<h2 class="section-label">Discord</h2>
				<p class="text-muted font-mono text-sm">{profile.discordUsername}</p>
			</div>
		{/if}
		{#if profile.bio}
			<div>
				<h2 class="section-label">Bio</h2>
				<p class="text-muted max-w-prose text-sm">{profile.bio}</p>
			</div>
		{/if}
		{#if profile.links && profile.links.length > 0}
			<div>
				<h2 class="section-label">Links</h2>
				<div class="flex flex-wrap gap-x-4 gap-y-1">
					{#each profile.links as link (link.url)}
						<a
							href={link.url}
							class="text-sm hover:underline"
							style="color: var(--accent-strong)"
							target="_blank"
							rel="noopener noreferrer nofollow external"
						>
							{link.name}
						</a>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{/if}

<div>
	<div class="mb-4 hidden justify-center sm:flex">
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
	<div class="relative mb-4 sm:hidden" bind:this={statusMenuEl}>
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
	{#if countsLoading && !counts}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each [0, 1, 2, 3] as i (i)}
				<div class="kc-card p-4">
					<p class="text-faint font-mono text-xs">&nbsp;</p>
				</div>
			{/each}
		</div>
	{:else if counts}
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each statTiles as tile (tile.label)}
				<a href={tile.href} class="kc-card block p-4">
					<p class="section-label mb-1">{tile.label}</p>
					<div class="flex items-end justify-between gap-2">
						<p class="heading-lg text-3xl" style="font-family: var(--font-display)">
							{tile.value}
						</p>
						{#if showPrices && formatPrice(tile.price, currency)}
							<p class="text-faint font-mono text-xs">{formatPrice(tile.price, currency)}</p>
						{/if}
					</div>
				</a>
			{/each}
		</div>
		{#if showPrices && formatPrice(grandTotal ?? undefined, currency)}
			<p class="text-muted mt-4 text-center text-sm">
				Total spent: <span class="font-mono">{formatPrice(grandTotal ?? undefined, currency)}</span>
			</p>
		{/if}
	{:else}
		<p class="text-muted text-sm">Could not load this collection's stats.</p>
	{/if}
</div>
