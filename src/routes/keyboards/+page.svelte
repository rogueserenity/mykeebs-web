<script lang="ts">
	import type { Keyboard } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keyboardsApi } from '$lib/api/client';
	import { orderStatusClass } from '$lib/format';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import KeyboardDetails from '$lib/components/KeyboardDetails.svelte';

	let selectedKeyboard = $state<Keyboard | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);

	async function openKeyboard(keyboardId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		detailError = null;
		detailLoading = true;
		selectedKeyboard = null;
		try {
			selectedKeyboard = await keyboardsApi.getKeyboard({ userId, keyboardId });
		} catch {
			detailError = 'Could not load this keyboard.';
		} finally {
			detailLoading = false;
		}
	}

	function closeModal() {
		selectedKeyboard = null;
		detailError = null;
		detailLoading = false;
	}
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		keyboardsApi.listKeyboards({ userId, cursor })}
	itemKey={(keyboard) => keyboard.id ?? ''}
	emptyMessage="No keyboards yet."
>
	{#snippet card(keyboard)}
		<button
			type="button"
			class="relative w-full card preset-tonal p-4 text-left"
			onclick={() => openKeyboard(keyboard.id ?? '')}
		>
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
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={detailLoading || detailError !== null || selectedKeyboard !== null}
	onClose={closeModal}
>
	{#if detailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg text-error-500">{detailError}</p>
	{:else if selectedKeyboard}
		<KeyboardDetails keyboard={selectedKeyboard} />
	{/if}
</Modal>
