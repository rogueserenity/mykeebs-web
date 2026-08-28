<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { Profile, BuildSummary } from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { profilesApi, buildsApi } from '$lib/api/client';
	import { auth } from '$lib/auth/auth.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { formatDate } from '$lib/format';

	type ViewState =
		| { status: 'loading' }
		| { status: 'not-found' }
		| { status: 'error' }
		| { status: 'ready'; profile: Profile };

	let view = $state<ViewState>({ status: 'loading' });
	let builds = $state<BuildSummary[]>([]);
	let buildsLoading = $state(false);

	let isOwnProfile = $derived(view.status === 'ready' && view.profile.userId === auth.user?.id);

	async function loadProfile(identifier: string) {
		view = { status: 'loading' };
		builds = [];
		try {
			const profile = await profilesApi.getProfile({ identifier });
			view = { status: 'ready', profile };
			if (profile.userId) loadBuilds(profile.userId);
		} catch (err) {
			view =
				err instanceof ResponseError && err.response.status === 404
					? { status: 'not-found' }
					: { status: 'error' };
		}
	}

	// The API scopes this to what the viewer is allowed to see: the owner
	// gets everything, anyone else gets only builds shared with them.
	async function loadBuilds(userId: string) {
		buildsLoading = true;
		try {
			const collected: BuildSummary[] = [];
			let cursor: string | undefined;
			do {
				const pageResult = await buildsApi.listBuilds({ userId, cursor });
				collected.push(...(pageResult.items ?? []));
				cursor = pageResult.nextCursor ?? undefined;
			} while (cursor);
			builds = collected;
		} catch {
			builds = [];
		} finally {
			buildsLoading = false;
		}
	}

	$effect(() => {
		loadProfile(page.params.username ?? '');
	});
</script>

<div class="mx-auto max-w-4xl px-4 py-10">
	{#if view.status === 'loading'}
		<p class="text-muted p-16 text-center font-mono text-sm tracking-wide">Loading&hellip;</p>
	{:else if view.status === 'not-found'}
		<div class="flex flex-col items-center gap-2 py-24 text-center">
			<p class="heading-lg text-xl">No one here.</p>
			<p class="text-muted text-sm">There's no profile at this username.</p>
		</div>
	{:else if view.status === 'error'}
		<p class="p-16 text-center text-lg" style="color: var(--danger)">
			Could not load this profile.
		</p>
	{:else}
		{@const profile = view.profile}
		<div class="flex items-start gap-5">
			<Avatar name={profile.username} imageUrl={profile.avatar?.url} size="lg" />
			<div class="min-w-0">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="heading-lg text-2xl">@{profile.username}</h1>
					{#if isOwnProfile}
						<a href={resolve('/profile/edit')} class="btn">Edit profile</a>
					{/if}
				</div>
				{#if profile.discordUsername}
					<p class="text-faint mt-2 font-mono text-xs">{profile.discordUsername}</p>
				{/if}
				{#if profile.bio}
					<p class="text-muted mt-3 max-w-prose text-sm">{profile.bio}</p>
				{/if}
				{#if profile.links && profile.links.length > 0}
					<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1">
						{#each profile.links as link (link.url)}
							<a
								href={link.url}
								class="text-sm hover:underline"
								style="color: var(--accent-strong)"
								target="_blank"
								rel="noopener noreferrer nofollow"
							>
								{link.name}
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="mt-10">
			<h2 class="section-label">Shared builds</h2>
			{#if buildsLoading}
				<p class="text-muted text-sm">Loading&hellip;</p>
			{:else if builds.length === 0}
				<p class="text-muted text-sm">No shared builds yet.</p>
			{:else}
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each builds as build (build.id)}
						<div class="kc-card flex items-center gap-3 p-4">
							<div
								class="kc-thumb text-faint flex h-16 w-16 shrink-0 items-center justify-center text-xs"
							>
								{#if build.image?.url}
									<img
										src={build.image.url}
										alt={build.keyboard?.name ?? 'Build'}
										class="h-full w-full object-contain"
									/>
								{:else}
									No image
								{/if}
							</div>
							<div class="min-w-0">
								<h3 class="heading-lg text-base">{build.keyboard?.name ?? 'Build'}</h3>
								{#if build.keyboard?.brand}
									<p class="text-muted text-sm">{build.keyboard.brand}</p>
								{/if}
								{#if formatDate(build.buildDate)}
									<p class="text-faint font-mono text-xs">{formatDate(build.buildDate)}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
