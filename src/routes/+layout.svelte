<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { ProfileSummary } from '@rogueserenity/kbdb-api-client';
	import { Menu, X } from 'lucide-svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initAuth } from '$lib/auth/auth.svelte';
	import { initProfile, profile } from '$lib/profile/profile.svelte';
	import { profilesApi } from '$lib/api/client';
	import AuthControl from '$lib/auth/AuthControl.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { setProfileSubNavContext, type ProfileSubNavContext } from '$lib/profile-subnav-context';

	let { children } = $props();

	const profileSubNav: ProfileSubNavContext = $state({ items: [] });
	setProfileSubNavContext(profileSubNav);

	onMount(() => {
		initAuth();
		initProfile();
	});

	let myCollectionHref = $derived(
		profile.status === 'ready'
			? resolve('/u/[username]/keyboards', { username: profile.data!.username })
			: undefined
	);

	const navItems = $derived(
		[
			myCollectionHref ? { href: myCollectionHref, label: 'My Collection' } : null,
			{ href: resolve('/discover'), label: 'Discover' }
		].filter((item) => item !== null)
	);

	let searchQuery = $state('');
	let searchResults = $state<ProfileSummary[]>([]);
	let searchOpen = $state(false);
	let searchLoading = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;

	function onSearchInput() {
		clearTimeout(debounceTimer);
		if (!searchQuery.trim()) {
			searchToken++;
			searchResults = [];
			searchOpen = false;
			searchLoading = false;
			return;
		}
		debounceTimer = setTimeout(runSearch, 250);
	}

	// Guards against a stale search overwriting a newer one's result.
	let searchToken = 0;

	async function runSearch() {
		const username = searchQuery.trim();
		if (!username) return;
		const token = ++searchToken;
		searchLoading = true;
		try {
			const result = await profilesApi.listProfiles({ username, limit: 6 });
			if (token !== searchToken) return;
			searchResults = result.items ?? [];
			searchOpen = true;
		} catch {
			if (token !== searchToken) return;
			searchResults = [];
		} finally {
			if (token === searchToken) searchLoading = false;
		}
	}

	function goToProfile(username: string) {
		searchQuery = '';
		searchResults = [];
		searchOpen = false;
		goto(resolve('/u/[username]', { username }));
	}

	function closeSearchSoon() {
		setTimeout(() => (searchOpen = false), 150);
	}

	let mobileMenuOpen = $state(false);
	$effect(() => {
		void page.url.pathname;
		mobileMenuOpen = false;
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<header class="app-header">
	<div class="md:hidden">
		<button
			type="button"
			class="btn-icon"
			aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
			aria-expanded={mobileMenuOpen}
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
		>
			{#if mobileMenuOpen}
				<X class="mx-auto h-5 w-5" />
			{:else}
				<Menu class="mx-auto h-5 w-5" />
			{/if}
		</button>
	</div>
	<div class="app-brand">
		<span class="app-brand-key">⌨</span>
		mykeebs
	</div>
	<div class="hidden md:block">
		<nav class="app-nav">
			{#each navItems as item (item.href)}
				<a
					href={item.href}
					class="nav-key {page.url.pathname.startsWith(item.href) ? 'is-active' : ''}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
	</div>
	<div class="relative hidden md:block">
		<input
			type="search"
			class="field-input w-56"
			placeholder="Find a builder…"
			bind:value={searchQuery}
			oninput={onSearchInput}
			onfocus={() => searchResults.length > 0 && (searchOpen = true)}
			onblur={closeSearchSoon}
		/>
		{#if searchOpen}
			<div
				class="absolute top-full right-0 z-50 mt-1 w-64 overflow-hidden rounded-md"
				style="background: var(--surface); border: 1px solid var(--border)"
			>
				{#if searchLoading}
					<p class="text-muted p-3 text-sm">Searching&hellip;</p>
				{:else if searchResults.length === 0}
					<p class="text-muted p-3 text-sm">No builders match that search.</p>
				{:else}
					{#each searchResults as summary (summary.userId)}
						<button
							type="button"
							class="user-card flex w-full items-center gap-2 p-2 text-left"
							onclick={() => goToProfile(summary.username ?? '')}
						>
							<Avatar name={summary.username ?? '?'} imageUrl={summary.avatar?.url} size="sm" />
							<div class="min-w-0 flex-1">
								<p class="heading-lg truncate text-sm" title={summary.username}>
									@{summary.username}
								</p>
								{#if summary.discordUsername}
									<p class="text-faint truncate font-mono text-xs" title={summary.discordUsername}>
										{summary.discordUsername}
									</p>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
	<div class="ml-auto flex min-w-0 items-center">
		<AuthControl />
	</div>
</header>
{#if mobileMenuOpen}
	<div class="app-mobile-menu md:hidden">
		<nav class="flex flex-col gap-1">
			{#each navItems as item (item.href)}
				<a
					href={item.href}
					class="nav-key {page.url.pathname.startsWith(item.href) ? 'is-active' : ''}"
				>
					{item.label}
				</a>
			{/each}
		</nav>
		{#if profileSubNav.items.length > 0}
			<div class="profile-menu-divider"></div>
			<nav class="flex flex-col gap-1">
				{#each profileSubNav.items as item (item.route)}
					{@const href = resolve(item.route, { username: item.username })}
					<a {href} class="nav-key {page.url.pathname === href ? 'is-active' : ''}">
						{item.label}
					</a>
				{/each}
			</nav>
		{/if}
	</div>
{/if}
{@render children()}
