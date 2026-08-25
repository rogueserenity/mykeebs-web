<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { exchangeCodeForToken } from '$lib/auth/auth.svelte';

	let error = $state<string | null>(null);

	onMount(() => {
		const code = page.url.searchParams.get('code');
		if (!code) {
			error = 'No authorization code in the redirect URL.';
			return;
		}

		exchangeCodeForToken(code)
			.then(() => goto(resolve('/')))
			.catch(() => {
				error = 'Sign-in failed. Please try again.';
			});
	});
</script>

<div class="flex min-h-[60vh] items-center justify-center">
	{#if error}
		<p style="color: var(--danger)">{error}</p>
	{:else}
		<p class="text-muted font-mono text-sm tracking-wide">Signing you in&hellip;</p>
	{/if}
</div>
