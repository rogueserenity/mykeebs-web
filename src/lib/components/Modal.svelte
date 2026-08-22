<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		onClose,
		wide = false,
		obscured = false,
		children
	}: {
		open: boolean;
		onClose: () => void;
		wide?: boolean;
		obscured?: boolean;
		children: Snippet;
	} = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={open && !obscured ? handleKeydown : undefined} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button type="button" aria-label="Close" class="absolute inset-0 bg-black/60" onclick={onClose}
		></button>
		<div
			class="relative max-h-[90vh] w-full card bg-surface-100-900 {wide
				? 'max-w-5xl'
				: 'max-w-3xl'} overflow-y-auto p-6 shadow-xl"
		>
			<button
				type="button"
				class="absolute top-4 right-4 btn-icon preset-tonal"
				aria-label="Close"
				onclick={onClose}
			>
				✕
			</button>
			{@render children()}
		</div>
	</div>
{/if}
