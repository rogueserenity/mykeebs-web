<script lang="ts">
	import type { Keyboard } from '@rogueserenity/kbdb-api-client';
	import PurchaseDetails from '$lib/components/PurchaseDetails.svelte';

	let { keyboard, onImageClick }: { keyboard: Keyboard; onImageClick: (index: number) => void } =
		$props();

	function materialColorText(part: { material?: string; color?: string } | undefined) {
		return part ? [part.color, part.material].filter(Boolean).join(' ') : undefined;
	}
</script>

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

{#if keyboard.images && keyboard.images.length > 0}
	<div class="mt-6">
		<h3 class="font-semibold">Images</h3>
		<div class="mt-2 flex flex-wrap gap-3">
			{#each keyboard.images as image, index (image.imageId)}
				<button
					type="button"
					class="h-20 w-20 shrink-0 overflow-hidden rounded bg-white"
					aria-label="View full size image"
					onclick={() => onImageClick(index)}
				>
					<img src={image.url} alt={keyboard.name} class="h-full w-full object-contain" />
				</button>
			{/each}
		</div>
	</div>
{/if}

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
