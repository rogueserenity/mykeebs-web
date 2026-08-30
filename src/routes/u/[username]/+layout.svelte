<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { Profile } from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { profilesApi } from '$lib/api/client';
	import { auth } from '$lib/auth/auth.svelte';
	import { setUserContext } from '$lib/user-context';
	import Avatar from '$lib/components/Avatar.svelte';

	let { children } = $props();

	type ViewState =
		| { status: 'loading' }
		| { status: 'not-found' }
		| { status: 'error' }
		| { status: 'ready'; profile: Profile };

	let view = $state<ViewState>({ status: 'loading' });

	async function loadProfile(identifier: string) {
		view = { status: 'loading' };
		try {
			const profile = await profilesApi.getProfile({ identifier });
			view = { status: 'ready', profile };
		} catch (err) {
			view =
				err instanceof ResponseError && err.response.status === 404
					? { status: 'not-found' }
					: { status: 'error' };
		}
	}

	$effect(() => {
		loadProfile(page.params.username ?? '');
	});

	let isOwnProfile = $derived(view.status === 'ready' && view.profile.userId === auth.user?.id);

	setUserContext({
		get userId() {
			return view.status === 'ready' ? (view.profile.userId ?? '') : '';
		},
		get username() {
			return view.status === 'ready' ? view.profile.username : '';
		},
		get profile() {
			if (view.status !== 'ready') throw new Error('Profile not loaded yet');
			return view.profile;
		},
		get isOwnProfile() {
			return isOwnProfile;
		}
	});

	const subNavItems = $derived(
		view.status === 'ready'
			? [
					{
						href: resolve('/u/[username]', { username: view.profile.username }),
						label: 'Overview'
					},
					{
						href: resolve('/u/[username]/keyboards', { username: view.profile.username }),
						label: 'Keyboards'
					},
					{
						href: resolve('/u/[username]/switches', { username: view.profile.username }),
						label: 'Switches'
					},
					{
						href: resolve('/u/[username]/keycap-sets', { username: view.profile.username }),
						label: 'Keycap Sets'
					},
					{
						href: resolve('/u/[username]/builds', { username: view.profile.username }),
						label: 'Builds'
					}
				]
			: []
	);
</script>

<div class="mx-auto max-w-6xl px-4 py-10">
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
		<div class="flex items-center gap-4">
			<Avatar name={profile.username} imageUrl={profile.avatar?.url} size="lg" />
			<div class="min-w-0 flex-1">
				<div class="flex flex-wrap items-center gap-3">
					<h1 class="heading-lg text-2xl">@{profile.username}</h1>
					{#if isOwnProfile}
						<a href={resolve('/profile/edit')} class="btn">Edit profile</a>
					{/if}
				</div>
			</div>
		</div>

		<nav class="app-nav mt-6 border-b pb-2" style="border-color: var(--border)">
			{#each subNavItems as item (item.href)}
				<a href={item.href} class="nav-key {page.url.pathname === item.href ? 'is-active' : ''}">
					{item.label}
				</a>
			{/each}
		</nav>

		<div class="mt-6">
			{@render children()}
		</div>
	{/if}
</div>
