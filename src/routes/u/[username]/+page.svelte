<script lang="ts">
	import { buildsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import { getUserContext } from '$lib/user-context';
	import { resolve } from '$app/paths';

	const userContext = getUserContext();

	type Counts = { keyboards: number; switches: number; keycapSets: number; builds: number };
	let counts = $state<Counts | null>(null);
	let countsLoading = $state(false);

	async function countAll<T>(
		fetchPage: (cursor: string | undefined) => Promise<{
			items?: T[];
			nextCursor?: string | null;
		}>
	): Promise<number> {
		let total = 0;
		let cursor: string | undefined;
		do {
			const pageResult = await fetchPage(cursor);
			total += pageResult.items?.length ?? 0;
			cursor = pageResult.nextCursor ?? undefined;
		} while (cursor);
		return total;
	}

	// The API scopes each of these to what the viewer is allowed to see: the
	// owner gets everything, anyone else gets only items shared with them.
	async function loadCounts(userId: string) {
		countsLoading = true;
		try {
			const [keyboards, switches, keycapSets, builds] = await Promise.all([
				countAll((cursor) => keyboardsApi.listKeyboards({ userId, cursor })),
				countAll((cursor) => switchesApi.listSwitches({ userId, cursor })),
				countAll((cursor) => keycapSetsApi.listKeycapSets({ userId, cursor })),
				countAll((cursor) => buildsApi.listBuilds({ userId, cursor }))
			]);
			counts = { keyboards, switches, keycapSets, builds };
		} catch {
			counts = null;
		} finally {
			countsLoading = false;
		}
	}

	$effect(() => {
		if (userContext.userId) loadCounts(userContext.userId);
	});

	const profile = $derived(userContext.profile);

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
