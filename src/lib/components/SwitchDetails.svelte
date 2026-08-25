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
				class="kc-thumb h-24 w-24 object-contain"
				onerror={() => (imageFailed = true)}
			/>
		</button>
	{/if}
	<div>
		<h2 class="heading-lg text-2xl">{sw.name}</h2>
		<p class="text-muted">{[sw.brand, sw.manufacturer].filter(Boolean).join(' · ')}</p>
		<p class="text-faint mt-1 font-mono text-sm">
			{[sw.type, sw.factoryLubed ? 'Factory lubed' : undefined].filter(Boolean).join(' · ')}
		</p>
		{#if sw.notes}
			<p class="text-muted mt-2 text-sm">{sw.notes}</p>
		{/if}
	</div>
</div>

<div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
	{#if sw.pins != null || sw.material}
		<div>
			<h3 class="section-label">Construction</h3>
			<dl class="spec-list">
				{#if sw.pins != null}
					<div class="spec-row">
						<dt>Pins</dt>
						<span class="spec-leader"></span>
						<dd>{sw.pins}</dd>
					</div>
				{/if}
				{#if sw.material?.topHousing}
					<div class="spec-row">
						<dt>Top housing</dt>
						<span class="spec-leader"></span>
						<dd>{sw.material.topHousing}</dd>
					</div>
				{/if}
				{#if sw.material?.bottomHousing}
					<div class="spec-row">
						<dt>Bottom housing</dt>
						<span class="spec-leader"></span>
						<dd>{sw.material.bottomHousing}</dd>
					</div>
				{/if}
				{#if sw.material?.stem}
					<div class="spec-row">
						<dt>Stem</dt>
						<span class="spec-leader"></span>
						<dd>{sw.material.stem}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if sw.force || sw.spring}
		<div>
			<h3 class="section-label">Feel</h3>
			<dl class="spec-list">
				{#if sw.force?.actuation != null}
					<div class="spec-row">
						<dt>Actuation force</dt>
						<span class="spec-leader"></span>
						<dd>{sw.force.actuation}g</dd>
					</div>
				{/if}
				{#if sw.force?.bottomOut != null}
					<div class="spec-row">
						<dt>Bottom-out force</dt>
						<span class="spec-leader"></span>
						<dd>{sw.force.bottomOut}g</dd>
					</div>
				{/if}
				{#if sw.spring?.material}
					<div class="spec-row">
						<dt>Spring material</dt>
						<span class="spec-leader"></span>
						<dd>{sw.spring.material}</dd>
					</div>
				{/if}
				{#if sw.spring?.preTravel != null}
					<div class="spec-row">
						<dt>Pre-travel</dt>
						<span class="spec-leader"></span>
						<dd>{sw.spring.preTravel}mm</dd>
					</div>
				{/if}
				{#if sw.spring?.totalTravel != null}
					<div class="spec-row">
						<dt>Total travel</dt>
						<span class="spec-leader"></span>
						<dd>{sw.spring.totalTravel}mm</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if sw.purchase}
		<div>
			<h3 class="section-label">Purchase</h3>
			<PurchaseDetails purchase={sw.purchase} />
		</div>
	{/if}
</div>
