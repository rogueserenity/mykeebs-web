<script lang="ts">
	import { auth, signIn, signOut } from './auth.svelte';
</script>

{#if auth.user}
	<div class="flex items-center gap-4">
		<span class="text-muted font-mono text-sm">{auth.user.email}</span>
		<button type="button" class="btn" onclick={signOut}>Sign out</button>
	</div>
{:else if auth.status === 'signed-out'}
	<button type="button" class="btn btn-accent" onclick={signIn}>Sign in</button>
{/if}
