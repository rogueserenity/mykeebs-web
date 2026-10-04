<script lang="ts">
	import { ArrowLeft, ArrowRight, X } from 'lucide-svelte';
	let {
		open,
		src,
		alt,
		onClose,
		onPrev,
		onNext,
		itemLabel = 'photo'
	}: {
		open: boolean;
		src: string;
		alt: string;
		onClose: () => void;
		onPrev?: () => void;
		onNext?: () => void;
		itemLabel?: string;
	} = $props();

	const MIN_SCALE = 1;
	const MAX_SCALE = 6;

	let scale = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let dragging = $state(false);
	let dragStartX = 0;
	let dragStartY = 0;
	let dragOriginX = 0;
	let dragOriginY = 0;

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track src so switching images resets zoom
		src;
		if (open) {
			scale = 1;
			offsetX = 0;
			offsetY = 0;
		}
	});

	function clampScale(value: number) {
		return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
	}

	function zoomIn() {
		scale = clampScale(scale + 0.5);
		if (scale === MIN_SCALE) {
			offsetX = 0;
			offsetY = 0;
		}
	}

	function zoomOut() {
		scale = clampScale(scale - 0.5);
		if (scale === MIN_SCALE) {
			offsetX = 0;
			offsetY = 0;
		}
	}

	function resetZoom() {
		scale = 1;
		offsetX = 0;
		offsetY = 0;
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		scale = clampScale(scale - event.deltaY * 0.01);
		if (scale === MIN_SCALE) {
			offsetX = 0;
			offsetY = 0;
		}
	}

	function handlePointerDown(event: PointerEvent) {
		if (scale === MIN_SCALE) return;
		dragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragOriginX = offsetX;
		dragOriginY = offsetY;
		(event.target as HTMLElement).setPointerCapture(event.pointerId);
	}

	function handlePointerMove(event: PointerEvent) {
		if (!dragging) return;
		offsetX = dragOriginX + (event.clientX - dragStartX);
		offsetY = dragOriginY + (event.clientY - dragStartY);
	}

	function handlePointerUp() {
		dragging = false;
	}

	let viewer = $state<HTMLDivElement | null>(null);
	let closeButton = $state<HTMLButtonElement | null>(null);

	$effect(() => {
		if (!open) return;
		const previouslyFocused = document.activeElement as HTMLElement | null;
		closeButton?.focus();
		return () => previouslyFocused?.focus();
	});

	function trapTab(event: KeyboardEvent) {
		const focusable = Array.from(
			viewer?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []
		);
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		} else if (!viewer?.contains(document.activeElement)) {
			event.preventDefault();
			first.focus();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
		else if (event.key === 'ArrowLeft') onPrev?.();
		else if (event.key === 'ArrowRight') onNext?.();
		else if (event.key === 'Tab') trapTab(event);
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		bind:this={viewer}
		role="dialog"
		aria-modal="true"
		aria-label="{alt}, full size"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
	>
		<button
			bind:this={closeButton}
			type="button"
			aria-label="Close"
			class="btn-icon absolute top-4 right-4 z-10 bg-black/70 text-white hover:bg-black/90"
			onclick={onClose}
		>
			<X class="h-5 w-5" />
		</button>

		<div class="absolute top-4 left-4 z-10 flex flex-col gap-2">
			<div class="flex gap-2">
				<button
					type="button"
					class="btn-icon bg-black/70 text-white hover:bg-black/90"
					aria-label="Zoom out"
					onclick={zoomOut}
				>
					−
				</button>
				<button
					type="button"
					class="btn bg-black/70 text-white hover:bg-black/90"
					aria-label="Reset zoom"
					onclick={resetZoom}
				>
					{Math.round(scale * 100)}%
				</button>
				<button
					type="button"
					class="btn-icon bg-black/70 text-white hover:bg-black/90"
					aria-label="Zoom in"
					onclick={zoomIn}
				>
					+
				</button>
			</div>
			<span class="rounded bg-black/70 px-3 py-1 text-center text-sm text-white/80">
				Scroll to zoom
			</span>
		</div>

		{#if onPrev}
			<button
				type="button"
				aria-label="Previous {itemLabel}"
				class="btn-icon absolute top-1/2 left-4 z-10 -translate-y-1/2 bg-black/70 text-white hover:bg-black/90"
				onclick={onPrev}
			>
				<ArrowLeft class="h-5 w-5" />
			</button>
		{/if}
		{#if onNext}
			<button
				type="button"
				aria-label="Next {itemLabel}"
				class="btn-icon absolute top-1/2 right-4 z-10 -translate-y-1/2 bg-black/70 text-white hover:bg-black/90"
				onclick={onNext}
			>
				<ArrowRight class="h-5 w-5" />
			</button>
		{/if}

		<div
			class="flex h-full w-full items-center justify-center overflow-hidden {scale > MIN_SCALE
				? dragging
					? 'cursor-grabbing'
					: 'cursor-grab'
				: ''}"
			onwheel={handleWheel}
			onpointerdown={handlePointerDown}
			onpointermove={handlePointerMove}
			onpointerup={handlePointerUp}
			onpointercancel={handlePointerUp}
			role="presentation"
		>
			<img
				{src}
				{alt}
				class="max-h-[90vh] max-w-[90vw] rounded select-none"
				style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transition: {dragging
					? 'none'
					: 'transform 0.15s ease-out'};"
				draggable="false"
				decoding="async"
			/>
		</div>
	</div>
{/if}
