<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initAuth } from '$lib/auth/auth.svelte';
	import AuthControl from '$lib/auth/AuthControl.svelte';

	let { children } = $props();

	onMount(() => {
		initAuth();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<header class="flex items-center justify-end p-4">
	<AuthControl />
</header>
{@render children()}
