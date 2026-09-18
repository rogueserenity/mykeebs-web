<script lang="ts">
	import type { Build } from '@rogueserenity/kbdb-api-client';
	import { formatDate, formatPrice } from '$lib/format';

	let {
		build,
		onKeyboardClick,
		onSwitchClick,
		onKeycapKitClick,
		onImageClick,
		currency,
		showPrice
	}: {
		build: Build;
		onKeyboardClick: (keyboardId: string) => void;
		onSwitchClick: (switchId: string) => void;
		onKeycapKitClick: (keycapSetId: string, kitId: string) => void;
		onImageClick: (index: number) => void;
		currency: string;
		showPrice: boolean;
	} = $props();

	const sortedKeycapKits = $derived(
		build.keycapKits
			? [...build.keycapKits].sort((a, b) =>
					(a.keycapSet?.name ?? '').localeCompare(b.keycapSet?.name ?? '')
				)
			: []
	);
</script>

<div class="pr-8">
	{#if build.keyboard}
		<button
			type="button"
			class="flex items-center gap-3 text-left"
			onclick={() => onKeyboardClick(build.keyboard!.id)}
		>
			{#if build.keyboard.imageUrl}
				<img
					src={build.keyboard.imageUrl}
					alt={build.keyboard.name}
					class="kc-thumb h-16 w-16 shrink-0 object-contain"
					decoding="async"
				/>
			{/if}
			<div>
				<h2 class="heading-lg text-2xl hover:underline">{build.keyboard.name}</h2>
				<p class="text-muted">{build.keyboard.brand}</p>
			</div>
		</button>
	{:else}
		<h2 class="heading-lg text-faint text-2xl">Deleted keyboard</h2>
	{/if}
	{#if formatDate(build.buildDate) || (showPrice && formatPrice(build.totalCost, currency))}
		<p class="text-faint mt-1 font-mono text-sm">
			{[formatDate(build.buildDate), showPrice ? formatPrice(build.totalCost, currency) : undefined]
				.filter(Boolean)
				.join(' · ')}
		</p>
	{/if}
	{#if build.notes}
		<p class="text-muted mt-2 text-sm">{build.notes}</p>
	{/if}
</div>

{#if build.images && build.images.length > 0}
	<div class="mt-6">
		<h3 class="section-label">Images</h3>
		<div class="flex flex-wrap gap-3">
			{#each build.images as image, index (image.imageId)}
				<button
					type="button"
					class="kc-thumb h-20 w-20 shrink-0 overflow-hidden"
					aria-label="View full size image"
					onclick={() => onImageClick(index)}
				>
					<img
						src={image.url}
						alt="Build"
						class="h-full w-full object-contain"
						loading="lazy"
						decoding="async"
					/>
				</button>
			{/each}
		</div>
	</div>
{/if}

<div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
	{#if build.plate || build.caseMountType || build.stabs || build.foam != null}
		<div>
			<h3 class="section-label">Build details</h3>
			<dl class="spec-list">
				{#if build.plate}
					<div class="spec-row">
						<dt>Plate</dt>
						<span class="spec-leader"></span>
						<dd>{build.plate}</dd>
					</div>
				{/if}
				{#if build.caseMountType?.type}
					<div class="spec-row">
						<dt>Mount type</dt>
						<span class="spec-leader"></span>
						<dd>
							{[build.caseMountType.type, build.caseMountType.durometer]
								.filter(Boolean)
								.join(' · ')}
						</dd>
					</div>
				{/if}
				{#if build.stabs?.name}
					<div class="spec-row">
						<dt>Stabs</dt>
						<span class="spec-leader"></span>
						<dd>{[build.stabs.name, build.stabs.mountType].filter(Boolean).join(' · ')}</dd>
					</div>
				{/if}
				{#if build.foam != null}
					<div class="spec-row">
						<dt>Foam</dt>
						<span class="spec-leader"></span>
						<dd>{build.foam ? 'Yes' : 'No'}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	{#if build.switches && build.switches.length > 0}
		<div>
			<h3 class="section-label">Switches</h3>
			<ul class="space-y-2 text-sm">
				{#each build.switches as entry, index (index)}
					<li>
						{#if entry._switch}
							<button
								type="button"
								class="flex items-center gap-2 text-left hover:underline"
								onclick={() => onSwitchClick(entry._switch!.id)}
							>
								{#if entry._switch.imageUrl}
									<img
										src={entry._switch.imageUrl}
										alt={entry._switch.name}
										class="kc-thumb h-8 w-8 shrink-0 object-contain"
										loading="lazy"
										decoding="async"
									/>
								{/if}
								<span class="font-mono"
									>{entry.count}x {entry._switch.name} ({entry._switch.brand})</span
								>
							</button>
						{:else}
							<span class="text-faint">{entry.count}x Deleted switch</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if sortedKeycapKits.length > 0}
		<div>
			<h3 class="section-label">Keycap kits</h3>
			<ul class="space-y-2 text-sm">
				{#each sortedKeycapKits as entry, index (entry.keycapSet ? `${entry.keycapSet.id}-${entry.kitId}` : index)}
					<li>
						{#if entry.keycapSet && entry.kitName}
							<button
								type="button"
								class="flex items-center gap-2 text-left hover:underline"
								onclick={() => onKeycapKitClick(entry.keycapSet!.id, entry.kitId)}
							>
								{#if entry.kitImageUrl}
									<img
										src={entry.kitImageUrl}
										alt={entry.kitName}
										class="kc-thumb h-8 w-8 shrink-0 object-contain"
										loading="lazy"
										decoding="async"
									/>
								{/if}
								<span class="font-mono">{entry.keycapSet.name} &mdash; {entry.kitName}</span>
							</button>
						{:else}
							<span class="text-faint">Deleted keycap kit</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
