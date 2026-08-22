<script lang="ts">
	import type { Keyboard } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { keyboardsApi } from '$lib/api/client';
	import { orderStatusClass } from '$lib/format';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import PurchaseDetails from '$lib/components/PurchaseDetails.svelte';

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

	function materialColorText(part: { material?: string; color?: string } | undefined) {
		return part ? [part.color, part.material].filter(Boolean).join(' ') : undefined;
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
		{@const keyboard = selectedKeyboard}
		<div class="pr-8">
			<h2 class="text-2xl font-bold">{keyboard.name}</h2>
			<p class="opacity-75">{keyboard.brand}</p>
			{#if keyboard.size || keyboard.layout}
				<p class="mt-1 text-sm">
					{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}
				</p>
			{/if}
			{#if keyboard.notes}
				<p class="mt-2 text-sm opacity-75">{keyboard.notes}</p>
			{/if}
		</div>

		<div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
			{#if keyboard.design}
				<div>
					<h3 class="font-semibold">Design</h3>
					<dl class="mt-2 space-y-2 text-sm">
						{#if materialColorText(keyboard.design.topCase)}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Top case</dt>
								<dd>{materialColorText(keyboard.design.topCase)}</dd>
							</div>
						{/if}
						{#if materialColorText(keyboard.design.bottomCase)}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Bottom case</dt>
								<dd>{materialColorText(keyboard.design.bottomCase)}</dd>
							</div>
						{/if}
						{#if materialColorText(keyboard.design.weight)}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Weight</dt>
								<dd>{materialColorText(keyboard.design.weight)}</dd>
							</div>
						{/if}
						{#if keyboard.design.plates && keyboard.design.plates.length > 0}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Plates</dt>
								<dd>{keyboard.design.plates.join(', ')}</dd>
							</div>
						{/if}
					</dl>
				</div>
			{/if}

			{#if keyboard.pcb}
				<div>
					<h3 class="font-semibold">PCB</h3>
					<dl class="mt-2 space-y-2 text-sm">
						{#if keyboard.pcb.thickness != null}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Thickness</dt>
								<dd>{keyboard.pcb.thickness}mm</dd>
							</div>
						{/if}
						{#if keyboard.pcb.firmware}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Firmware</dt>
								<dd>{keyboard.pcb.firmware}</dd>
							</div>
						{/if}
						{#if keyboard.pcb.assembly}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Assembly</dt>
								<dd>{keyboard.pcb.assembly}</dd>
							</div>
						{/if}
						{#if keyboard.pcb.connectivity}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Connectivity</dt>
								<dd>{keyboard.pcb.connectivity}</dd>
							</div>
						{/if}
					</dl>
				</div>
			{/if}

			{#if keyboard.purchase}
				<div>
					<h3 class="font-semibold">Purchase</h3>
					<PurchaseDetails purchase={keyboard.purchase} />
				</div>
			{/if}
		</div>
	{/if}
</Modal>
