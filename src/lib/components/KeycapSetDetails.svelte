<script lang="ts">
	import type { KeycapKit, KeycapSet } from '@rogueserenity/kbdb-api-client';
	import { orderStatusClass } from '$lib/format';

	let {
		set,
		failedImages,
		onImageError,
		onKitClick,
		onAddKit
	}: {
		set: KeycapSet;
		failedImages: Set<string>;
		onImageError: (kitId: string) => void;
		onKitClick: (kit: KeycapKit) => void;
		onAddKit?: () => void;
	} = $props();
</script>

<div class="pr-8">
	<h2 class="heading-lg text-2xl">{set.name}</h2>
	<p class="text-muted">{set.brand}</p>
	{#if set.profile || set.material}
		<p class="text-faint mt-1 font-mono text-sm">
			{[set.profile, set.material].filter(Boolean).join(' · ')}
		</p>
	{/if}
	{#if set.notes}
		<p class="text-muted mt-2 text-sm">{set.notes}</p>
	{/if}
</div>

<div class="mt-6 flex items-center justify-between">
	<h3 class="section-label">Kits</h3>
	{#if onAddKit}
		<button type="button" class="btn" onclick={onAddKit}>+ Add kit</button>
	{/if}
</div>

{#if set.kits && set.kits.length > 0}
	<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
		{#each set.kits as kit (kit.kitId)}
			{@const imageFailed = failedImages.has(kit.kitId)}
			<button
				type="button"
				class="kc-card w-full overflow-hidden p-3 text-left"
				onclick={() => onKitClick(kit)}
			>
				{#if kit.image?.url && !imageFailed}
					<img
						src={kit.image.url}
						alt={kit.name}
						class="kc-thumb-tile aspect-square w-full object-contain"
						onerror={() => onImageError(kit.kitId)}
					/>
				{:else}
					<div
						class="kc-thumb-tile text-faint flex aspect-square w-full items-center justify-center text-sm"
					>
						No image
					</div>
				{/if}
				<div class="mt-2 flex items-center justify-between gap-2 pr-1">
					<h3 class="flex items-center gap-1.5 font-semibold">
						{kit.name}
						{#if kit.kitId === set.primaryKitId}
							<span class="text-faint text-xs" title="Primary kit">★</span>
						{/if}
					</h3>
					{#if kit.purchase?.orderStatus}
						<span class="status-badge shrink-0 {orderStatusClass(kit.purchase.orderStatus)}">
							{kit.purchase.orderStatus}
						</span>
					{/if}
				</div>
			</button>
		{/each}
	</div>
{:else}
	<p class="text-muted mt-3 text-sm">No kits recorded for this set.</p>
{/if}
