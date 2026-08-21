<script lang="ts">
	import type { KeyboardSummary } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keyboardsApi } from '$lib/api/client';

	let keyboards = $state<KeyboardSummary[]>([]);
	let loadError = $state<string | null>(null);

	$effect(() => {
		const userId = auth.user?.id;
		if (!userId) return;

		loadError = null;
		keyboardsApi
			.listKeyboards({ userId })
			.then((page) => {
				keyboards = page.items ?? [];
			})
			.catch(() => {
				loadError = 'Could not load your keyboards.';
			});
	});
</script>

{#if auth.status === 'loading'}
	<p class="p-4">Loading&hellip;</p>
{:else if auth.status === 'signed-out'}
	<p class="p-4">Sign in to see your keyboard collection.</p>
{:else if loadError}
	<p class="p-4 text-error-500">{loadError}</p>
{:else if keyboards.length === 0}
	<p class="p-4">No keyboards yet.</p>
{:else}
	<div class="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each keyboards as keyboard (keyboard.id)}
			<div class="card preset-tonal p-4">
				<h2 class="text-lg font-bold">{keyboard.name}</h2>
				<p class="text-sm opacity-75">{keyboard.brand}</p>
				{#if keyboard.size || keyboard.layout}
					<p class="text-sm">{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
