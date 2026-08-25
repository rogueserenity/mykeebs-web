<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		onClose,
		wide = false,
		obscured = false,
		headerExtra,
		children
	}: {
		open: boolean;
		onClose: () => void;
		wide?: boolean;
		obscured?: boolean;
		headerExtra?: Snippet;
		children: Snippet;
	} = $props();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={open && !obscured ? handleKeydown : undefined} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close"
			class="kc-modal-backdrop absolute inset-0"
			onclick={onClose}
		></button>
		<div
			class="kc-modal-panel max-h-[90vh] w-full {wide
				? 'max-w-5xl'
				: 'max-w-3xl'} overflow-y-auto p-6"
		>
			<div class="absolute top-4 right-4 flex items-center gap-2">
				{#if headerExtra}
					{@render headerExtra()}
				{/if}
				<button type="button" class="btn-icon" aria-label="Close" onclick={onClose}> ✕ </button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
