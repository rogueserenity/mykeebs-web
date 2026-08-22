<script lang="ts">
	let {
		open,
		src,
		alt,
		onClose,
		onPrev,
		onNext
	}: {
		open: boolean;
		src: string;
		alt: string;
		onClose: () => void;
		onPrev?: () => void;
		onNext?: () => void;
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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
		<button
			type="button"
			aria-label="Close"
			class="absolute top-4 right-4 z-10 btn-icon bg-black/70 text-white hover:bg-black/90"
			onclick={onClose}
		>
			✕
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
				aria-label="Previous kit"
				class="absolute top-1/2 left-4 z-10 btn-icon -translate-y-1/2 bg-black/70 text-white hover:bg-black/90"
				onclick={onPrev}
			>
				←
			</button>
		{/if}
		{#if onNext}
			<button
				type="button"
				aria-label="Next kit"
				class="absolute top-1/2 right-4 z-10 btn-icon -translate-y-1/2 bg-black/70 text-white hover:bg-black/90"
				onclick={onNext}
			>
				→
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
				class="max-h-[90vh] max-w-[90vw] rounded bg-white select-none"
				style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transition: {dragging
					? 'none'
					: 'transform 0.15s ease-out'};"
				draggable="false"
			/>
		</div>
	</div>
{/if}
