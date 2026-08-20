<script lang="ts">
	import { auth, signIn, signOut } from './auth.svelte';
</script>

{#if auth.user}
	<div class="flex items-center gap-4">
		<span class="text-sm">{auth.user.email}</span>
		<button type="button" class="btn preset-tonal" onclick={signOut}>Sign out</button>
	</div>
{:else if auth.status === 'signed-out'}
	<button type="button" class="btn preset-filled-primary-500" onclick={signIn}>Sign in</button>
{/if}
