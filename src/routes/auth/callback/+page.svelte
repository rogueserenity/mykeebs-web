<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { initAuth } from '$lib/auth/auth.svelte';

	// AuthKit's client processes the ?code=... redirect during initAuth()
	// (called from the root layout); once the shared init promise resolves
	// here too, the user is signed in and we can leave this page.
	onMount(() => {
		initAuth().then(() => goto(resolve('/')));
	});
</script>

<p>Signing you in&hellip;</p>
