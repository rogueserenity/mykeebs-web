<script lang="ts">
	import type { Switch as SwitchModel } from '@rogueserenity/kbdb-api-client';
	import PurchaseDetails from '$lib/components/PurchaseDetails.svelte';

	let { sw, onImageClick }: { sw: SwitchModel; onImageClick: () => void } = $props();

	let imageFailed = $state(false);
</script>

<div class="flex items-start gap-4 pr-8">
	{#if sw.image?.url && !imageFailed}
		<button
			type="button"
			class="shrink-0 cursor-zoom-in"
			aria-label="View full size image"
			onclick={onImageClick}
		>
			<img
				src={sw.image.url}
				alt={sw.name}
				class="h-24 w-24 rounded object-contain"
				onerror={() => (imageFailed = true)}
			/>
		</button>
	{/if}
	<div>
		<h2 class="text-2xl font-bold">{sw.name}</h2>
		<p class="opacity-75">{[sw.brand, sw.manufacturer].filter(Boolean).join(' · ')}</p>
		<p class="mt-1 text-sm">
			{[sw.type, sw.factoryLubed ? 'Factory lubed' : undefined].filter(Boolean).join(' · ')}
		</p>
		{#if sw.notes}
			<p class="mt-2 text-sm opacity-75">{sw.notes}</p>
		{/if}
	</div>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
	{#if sw.pins != null || sw.material}
		<div>
			<h3 class="font-semibold">Construction</h3>
			<dl class="mt-2 space-y-2 text-sm">
				{#if sw.pins != null}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Pins</dt>
						<dd>{sw.pins}</dd>
					</div>
				{/if}
				{#if sw.material?.topHousing}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Top housing</dt>
						<dd>{sw.material.topHousing}</dd>
					</div>
				{/if}
				{#if sw.material?.bottomHousing}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Bottom housing</dt>
						<dd>{sw.material.bottomHousing}</dd>
					</div>
				{/if}
				{#if sw.material?.stem}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Stem</dt>
						<dd>{sw.material.stem}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if sw.force || sw.spring}
		<div>
			<h3 class="font-semibold">Feel</h3>
			<dl class="mt-2 space-y-2 text-sm">
				{#if sw.force?.actuation != null}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Actuation force</dt>
						<dd>{sw.force.actuation}g</dd>
					</div>
				{/if}
				{#if sw.force?.bottomOut != null}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Bottom-out force</dt>
						<dd>{sw.force.bottomOut}g</dd>
					</div>
				{/if}
				{#if sw.spring?.material}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Spring material</dt>
						<dd>{sw.spring.material}</dd>
					</div>
				{/if}
				{#if sw.spring?.preTravel != null}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Pre-travel</dt>
						<dd>{sw.spring.preTravel}mm</dd>
					</div>
				{/if}
				{#if sw.spring?.totalTravel != null}
					<div class="flex justify-between gap-4">
						<dt class="opacity-75">Total travel</dt>
						<dd>{sw.spring.totalTravel}mm</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if sw.purchase}
		<div>
			<h3 class="font-semibold">Purchase</h3>
			<PurchaseDetails purchase={sw.purchase} />
		</div>
	{/if}
</div>
