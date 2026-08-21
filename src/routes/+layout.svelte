<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initAuth } from '$lib/auth/auth.svelte';
	import AuthControl from '$lib/auth/AuthControl.svelte';

	let { children } = $props();

	onMount(() => {
		initAuth();
	});

	const navItems = [
		{ href: resolve('/keyboards'), label: 'Keyboards' },
		{ href: resolve('/switches'), label: 'Switches' }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<header class="flex items-center justify-between p-4">
	<nav class="flex gap-2">
		{#each navItems as item (item.href)}
			<a
				href={item.href}
				class="btn {page.url.pathname.startsWith(item.href)
					? 'preset-filled-primary-500'
					: 'preset-tonal'}"
			>
				{item.label}
			</a>
		{/each}
	</nav>
	<AuthControl />
</header>
{@render children()}
