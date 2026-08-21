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

{#if error}
	<p class="text-error-500">{error}</p>
{:else}
	<p>Signing you in&hellip;</p>
{/if}
