<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import type { ProfileSummary } from '@rogueserenity/kbdb-api-client';
	import { profilesApi } from '$lib/api/client';
	import Avatar from '$lib/components/Avatar.svelte';

	// Server-side begins-with filter on username. Debounced so each
	// keystroke doesn't fire a request. An empty query lists the directory
	// from the top.
	let query = $state('');
	let results = $state<ProfileSummary[]>([]);
	let nextCursor = $state<string | null>(null);
	let loading = $state(false);
	let loadingMore = $state(false);
	let loadError = $state<string | null>(null);

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function onInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(runSearch, 250);
	}

	async function runSearch() {
		const username = query.trim() || undefined;
		loading = true;
		loadError = null;
		try {
			const page = await profilesApi.listProfiles({ username });
			results = page.items ?? [];
			nextCursor = page.nextCursor ?? null;
		} catch {
			loadError = 'Could not load the directory.';
			results = [];
			nextCursor = null;
		} finally {
			loading = false;
		}
	}

	async function loadMore() {
		if (!nextCursor) return;
		loadingMore = true;
		try {
			const page = await profilesApi.listProfiles({
				username: query.trim() || undefined,
				cursor: nextCursor
			});
			results = [...results, ...(page.items ?? [])];
			nextCursor = page.nextCursor ?? null;
		} catch {
			loadError = 'Could not load more results.';
		} finally {
			loadingMore = false;
		}
	}

	onMount(() => {
		runSearch();
		return () => clearTimeout(debounceTimer);
	});
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
	<h1 class="heading-lg text-2xl">Discover builders</h1>
	<p class="text-muted mt-1 text-sm">
		Search for other collectors and browse the boards they've shared publicly.
	</p>

	<input
		type="search"
		class="field-input mt-6 w-full"
		placeholder="Search by username..."
		bind:value={query}
		oninput={onInput}
	/>

	<div class="mt-6 flex flex-col gap-3">
		{#if loading}
			<p class="text-muted p-8 text-center text-sm">Loading&hellip;</p>
		{:else if loadError}
			<p class="p-8 text-center text-sm" style="color: var(--danger)">{loadError}</p>
		{:else if results.length === 0}
			<p class="text-muted p-8 text-center text-sm">No builders match that search.</p>
		{:else}
			{#each results as summary (summary.userId)}
				<a
					href={resolve('/u/[username]', { username: summary.username ?? '' })}
					class="kc-card user-card p-4"
				>
					<Avatar name={summary.username ?? '?'} imageUrl={summary.avatar?.url} size="sm" />
					<div class="min-w-0 flex-1">
						<h2 class="heading-lg text-sm">@{summary.username}</h2>
						{#if summary.discordUsername}
							<p class="text-faint font-mono text-xs">{summary.discordUsername}</p>
						{/if}
					</div>
				</a>
			{/each}
			{#if nextCursor}
				<button type="button" class="btn mx-auto mt-2" disabled={loadingMore} onclick={loadMore}>
					{loadingMore ? 'Loading…' : 'Load more'}
				</button>
			{/if}
		{/if}
	</div>
</div>
