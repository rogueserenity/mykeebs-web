<script lang="ts">
	import type { KeyboardSummary } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keyboardsApi } from '$lib/api/client';

	let keyboards = $state<KeyboardSummary[]>([]);
	let loadError = $state<string | null>(null);

	const orderStatusColors: Record<string, string> = {
		ordered: 'preset-filled-warning-500',
		shipped: 'preset-filled-tertiary-500',
		delivered: 'preset-filled-success-500',
		sold: 'preset-filled-surface-500'
	};

	function orderStatusClass(status: string) {
		return orderStatusColors[status.toLowerCase()] ?? 'preset-filled-primary-500';
	}

	$effect(() => {
		const userId = auth.user?.id;
		if (!userId) return;

		loadError = null;
		(async () => {
			const allKeyboards: KeyboardSummary[] = [];
			let cursor: string | undefined;
			do {
				const page = await keyboardsApi.listKeyboards({ userId, cursor });
				allKeyboards.push(...(page.items ?? []));
				cursor = page.nextCursor ?? undefined;
			} while (cursor);
			keyboards = allKeyboards;
		})().catch(() => {
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
			<div class="relative card preset-tonal p-4">
				{#if keyboard.orderStatus}
					<span class="absolute top-4 right-4 badge {orderStatusClass(keyboard.orderStatus)}">
						{keyboard.orderStatus}
					</span>
				{/if}
				<h2 class="pr-4 text-lg font-bold">{keyboard.name}</h2>
				<p class="text-sm opacity-75">{keyboard.brand}</p>
				{#if keyboard.size || keyboard.layout}
					<p class="text-sm">{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}</p>
				{/if}
			</div>
		{/each}
	</div>
{/if}
