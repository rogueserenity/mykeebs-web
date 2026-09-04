<script lang="ts">
	import { buildsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import { getUserContext } from '$lib/user-context';
	import { resolve } from '$app/paths';

	const userContext = getUserContext();

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

	let itemStatuses = $state<{
		keyboards: string[];
		switches: string[];
		keycapSets: string[];
		builds: number;
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
				fetchAll<{ orderStatus?: string }>((cursor) =>
					keyboardsApi.listKeyboards({ userId, cursor })
				),
				fetchAll<{ orderStatus?: string }>((cursor) =>
					switchesApi.listSwitches({ userId, cursor })
				),
				fetchAll<{ orderStatus?: string | null }>((cursor) =>
					keycapSetsApi.listKeycapSets({ userId, cursor })
				),
				fetchAll((cursor) => buildsApi.listBuilds({ userId, cursor }))
			]);
			itemStatuses = {
				keyboards: keyboards.map((k) => k.orderStatus ?? ''),
				switches: switches.map((s) => s.orderStatus ?? ''),
				keycapSets: keycapSets.map((k) => k.orderStatus ?? ''),
				builds: builds.length
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

	function countFor(statuses: string[], filter: StatusFilter): number {
		if (filter === 'all') return statuses.length;
		return statuses.filter((s) => s.toLowerCase() === filter).length;
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

	const statTiles = $derived(
		counts
			? [
					{
						label: 'Keyboards',
						value: counts.keyboards,
						href: resolve('/u/[username]/keyboards', { username: userContext.username })
					},
					{
						label: 'Switches',
						value: counts.switches,
						href: resolve('/u/[username]/switches', { username: userContext.username })
					},
					{
						label: 'Keycap Sets',
						value: counts.keycapSets,
						href: resolve('/u/[username]/keycap-sets', { username: userContext.username })
					},
					{
						label: 'Builds',
						value: counts.builds,
						href: resolve('/u/[username]/builds', { username: userContext.username })
					}
				]
			: []
	);
</script>

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
	<div class="mb-4 flex justify-center">
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
					<p class="heading-lg text-3xl" style="font-family: var(--font-display)">{tile.value}</p>
				</a>
			{/each}
		</div>
	{:else}
		<p class="text-muted text-sm">Could not load this collection's stats.</p>
	{/if}
</div>
