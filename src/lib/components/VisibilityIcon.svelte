<script lang="ts">
	import { Visibility } from '@rogueserenity/kbdb-api-client';

	let {
		visibility,
		mixed = false,
		class: className = 'h-3.5 w-3.5 shrink-0'
	}: {
		visibility: Visibility | undefined;
		mixed?: boolean;
		class?: string;
	} = $props();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={className}
>
	{#if mixed}
		<circle cx="12" cy="12" r="9" />
		<path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
	{:else if visibility === Visibility.Public}
		<circle cx="12" cy="12" r="9" />
		<path d="M3 12h18" />
		<path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
	{:else if visibility === Visibility.Authenticated}
		<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	{:else}
		<rect x="4" y="10" width="16" height="11" rx="2" />
		<path d="M8 10V7a4 4 0 0 1 8 0v3" />
	{/if}
</svg>
