<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		onClose,
		wide = false,
		obscured = false,
		dirty = false,
		headerExtra,
		children
	}: {
		open: boolean;
		onClose: () => void;
		wide?: boolean;
		obscured?: boolean;
		// When true, backdrop-click/Escape/the ✕ button don't close
		// immediately — they surface an inline "Discard changes?" prompt
		// instead, so an accidental click outside a form in progress can't
		// silently throw away edits.
		dirty?: boolean;
		headerExtra?: Snippet;
		children: Snippet;
	} = $props();

	let confirmingDiscard = $state(false);
	let panel = $state<HTMLDivElement | null>(null);
	let previouslyFocused: HTMLElement | null = null;

	function requestClose() {
		if (dirty) confirmingDiscard = true;
		else onClose();
	}

	function discardAndClose() {
		confirmingDiscard = false;
		onClose();
	}

	function focusableElements(): HTMLElement[] {
		if (!panel) return [];
		return Array.from(
			panel.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => el.offsetParent !== null);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (confirmingDiscard) confirmingDiscard = false;
			else requestClose();
			return;
		}

		// Trap Tab/Shift+Tab within the modal so keyboard users can't
		// escape into the page behind it — without this, Tab walks past
		// the last focusable element in the modal straight into whatever
		// the underlying page has, which reads as controls being randomly
		// skipped.
		if (event.key !== 'Tab' || obscured) return;
		const focusable = focusableElements();
		if (focusable.length === 0) return;

		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement;

		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	$effect(() => {
		if (!open) {
			confirmingDiscard = false;
			return;
		}

		previouslyFocused = document.activeElement as HTMLElement | null;
		// Defer to let the just-opened content mount before searching it
		// for a focus target.
		const raf = requestAnimationFrame(() => {
			const explicit = panel?.querySelector<HTMLElement>('[data-autofocus]');
			(explicit ?? focusableElements()[0])?.focus();
		});

		return () => {
			cancelAnimationFrame(raf);
			previouslyFocused?.focus();
			previouslyFocused = null;
		};
	});
</script>

<svelte:window onkeydown={open && !obscured ? handleKeydown : undefined} />

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			aria-label="Close"
			class="kc-modal-backdrop absolute inset-0"
			onclick={requestClose}
		></button>
		<div
			bind:this={panel}
			role="dialog"
			aria-modal="true"
			class="kc-modal-panel max-h-[90vh] w-full {wide
				? 'max-w-5xl'
				: 'max-w-3xl'} overflow-y-auto p-6"
		>
			{#if confirmingDiscard}
				<div
					class="mb-4 flex flex-wrap items-center gap-2 rounded border p-3"
					style="border-color: var(--danger)"
				>
					<span class="text-sm">Discard your changes?</span>
					<button type="button" class="btn" style="color: var(--danger)" onclick={discardAndClose}>
						Discard
					</button>
					<button type="button" class="btn" onclick={() => (confirmingDiscard = false)}>
						Keep editing
					</button>
				</div>
			{/if}
			<div class="absolute top-4 right-4 flex items-center gap-2">
				{#if headerExtra}
					{@render headerExtra()}
				{/if}
				<button type="button" class="btn-icon" aria-label="Close" onclick={requestClose}>
					✕
				</button>
			</div>
			{@render children()}
		</div>
	</div>
{/if}
