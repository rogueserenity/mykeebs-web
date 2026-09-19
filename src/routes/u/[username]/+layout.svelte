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

	// Below md the tab strip scrolls horizontally rather than wrapping;
	// these track scroll position so the fade hints on each edge only show
	// when there's actually more to scroll to in that direction.
	let subNavEl = $state<HTMLElement | null>(null);
	let subNavCanScrollLeft = $state(false);
	let subNavCanScrollRight = $state(false);

	function updateSubNavScrollState() {
		if (!subNavEl) return;
		subNavCanScrollLeft = subNavEl.scrollLeft > 0;
		subNavCanScrollRight = subNavEl.scrollLeft + subNavEl.clientWidth < subNavEl.scrollWidth - 1;
	}

	// Measures right after the nav's tabs render (subNavItems changing means
	// the tab count/labels are in the DOM). A window resize can also flip
	// whether the strip overflows at all (e.g. crossing the md breakpoint),
	// so that's re-checked via the onresize handler on the markup below.
	$effect(() => {
		void subNavItems;
		requestAnimationFrame(updateSubNavScrollState);
	});

	// A full page load (not a client-side nav) remounts this component with
	// the strip scrolled back to its start, so a tab scrolled off-screen
	// (e.g. Builds) looks like it vanished even though it's still marked
	// active. Scrolling the active tab into view -- on mount, and again
	// whenever the active tab changes via a same-page client-side nav --
	// keeps it visible either way. scrollIntoView with block/inline
	// "nearest" is a no-op when the tab's already in view, so this doesn't
	// jank the strip on desktop where every tab fits already.
	$effect(() => {
		void page.url.pathname;
		if (!subNavEl) return;
		const activeLink = subNavEl.querySelector<HTMLAnchorElement>('.nav-key.is-active');
		activeLink?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	});
</script>

<svelte:window onresize={updateSubNavScrollState} />

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

		<div class="profile-subnav-wrap mt-6 border-b" style="border-color: var(--border)">
			<nav
				bind:this={subNavEl}
				class="app-nav profile-subnav pb-2"
				onscroll={updateSubNavScrollState}
			>
				{#each subNavItems as item (item.href)}
					<a href={item.href} class="nav-key {page.url.pathname === item.href ? 'is-active' : ''}">
						{item.label}
					</a>
				{/each}
			</nav>
			{#if subNavCanScrollLeft}
				<div class="profile-subnav-fade profile-subnav-fade-left"></div>
			{/if}
			{#if subNavCanScrollRight}
				<div class="profile-subnav-fade profile-subnav-fade-right"></div>
			{/if}
		</div>

		<div class="mt-6">
			{@render children()}
		</div>
	{/if}
</div>
