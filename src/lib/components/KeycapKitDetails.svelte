<script lang="ts">
	import PurchaseDetails from '$lib/components/PurchaseDetails.svelte';
	import type { PurchaseLike } from '$lib/format';

	let {
		name,
		imageUrl,
		imageFailed,
		onImageError,
		onImageClick,
		purchase
	}: {
		name: string;
		imageUrl: string | undefined;
		imageFailed: boolean;
		onImageError: () => void;
		onImageClick: () => void;
		purchase: PurchaseLike | undefined;
	} = $props();
</script>

<div class="grid grid-cols-1 gap-6 pr-8 sm:grid-cols-2">
	{#if imageUrl && !imageFailed}
		<button
			type="button"
			class="cursor-zoom-in"
			aria-label="View full size image"
			onclick={onImageClick}
		>
			<img
				src={imageUrl}
				alt={name}
				class="kc-thumb max-h-[70vh] w-full object-contain"
				onerror={onImageError}
			/>
		</button>
	{:else}
		<div class="kc-thumb text-faint flex aspect-square w-full items-center justify-center text-sm">
			No image
		</div>
	{/if}
	<div>
		<h2 class="heading-lg text-2xl">{name}</h2>
		<PurchaseDetails {purchase} />
	</div>
</div>
