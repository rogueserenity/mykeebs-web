<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initAuth } from '$lib/auth/auth.svelte';
	import { initProfile } from '$lib/profile/profile.svelte';
	import AuthControl from '$lib/auth/AuthControl.svelte';

	let { children } = $props();

	onMount(() => {
		initAuth();
		initProfile();
	});

	const navItems = [
		{ href: resolve('/keyboards'), label: 'Keyboards' },
		{ href: resolve('/switches'), label: 'Switches' },
		{ href: resolve('/keycap-sets'), label: 'Keycap Sets' },
		{ href: resolve('/builds'), label: 'Builds' },
		{ href: resolve('/discover'), label: 'Discover' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<header class="app-header">
	<div class="app-brand">
		<span class="app-brand-key">⌨</span>
		mykeebs
	</div>
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
	<AuthControl />
</header>
{@render children()}
