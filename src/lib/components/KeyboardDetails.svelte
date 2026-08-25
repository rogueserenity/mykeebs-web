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
	<h2 class="heading-lg text-2xl">{keyboard.name}</h2>
	<p class="text-muted">{keyboard.brand}</p>
	{#if keyboard.size || keyboard.layout}
		<p class="text-faint mt-1 font-mono text-sm">
			{[keyboard.size, keyboard.layout].filter(Boolean).join(' · ')}
		</p>
	{/if}
	{#if keyboard.notes}
		<p class="text-muted mt-2 text-sm">{keyboard.notes}</p>
	{/if}
</div>

{#if keyboard.images && keyboard.images.length > 0}
	<div class="mt-6">
		<h3 class="section-label">Images</h3>
		<div class="flex flex-wrap gap-3">
			{#each keyboard.images as image, index (image.imageId)}
				<button
					type="button"
					class="kc-thumb h-20 w-20 shrink-0 overflow-hidden"
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
			<h3 class="section-label">Design</h3>
			<dl class="spec-list">
				{#if materialColorText(keyboard.design.topCase)}
					<div class="spec-row">
						<dt>Top case</dt>
						<span class="spec-leader"></span>
						<dd>{materialColorText(keyboard.design.topCase)}</dd>
					</div>
				{/if}
				{#if materialColorText(keyboard.design.bottomCase)}
					<div class="spec-row">
						<dt>Bottom case</dt>
						<span class="spec-leader"></span>
						<dd>{materialColorText(keyboard.design.bottomCase)}</dd>
					</div>
				{/if}
				{#if materialColorText(keyboard.design.weight)}
					<div class="spec-row">
						<dt>Weight</dt>
						<span class="spec-leader"></span>
						<dd>{materialColorText(keyboard.design.weight)}</dd>
					</div>
				{/if}
				{#if keyboard.design.plates && keyboard.design.plates.length > 0}
					<div class="spec-row">
						<dt>Plates</dt>
						<span class="spec-leader"></span>
						<dd>{keyboard.design.plates.join(', ')}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if keyboard.pcb}
		<div>
			<h3 class="section-label">PCB</h3>
			<dl class="spec-list">
				{#if keyboard.pcb.thickness != null}
					<div class="spec-row">
						<dt>Thickness</dt>
						<span class="spec-leader"></span>
						<dd>{keyboard.pcb.thickness}mm</dd>
					</div>
				{/if}
				{#if keyboard.pcb.firmware}
					<div class="spec-row">
						<dt>Firmware</dt>
						<span class="spec-leader"></span>
						<dd>{keyboard.pcb.firmware}</dd>
					</div>
				{/if}
				{#if keyboard.pcb.assembly}
					<div class="spec-row">
						<dt>Assembly</dt>
						<span class="spec-leader"></span>
						<dd>{keyboard.pcb.assembly}</dd>
					</div>
				{/if}
				{#if keyboard.pcb.connectivity}
					<div class="spec-row">
						<dt>Connectivity</dt>
						<span class="spec-leader"></span>
						<dd>{keyboard.pcb.connectivity}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if keyboard.purchase}
		<div>
			<h3 class="section-label">Purchase</h3>
			<PurchaseDetails purchase={keyboard.purchase} />
		</div>
	{/if}
</div>
