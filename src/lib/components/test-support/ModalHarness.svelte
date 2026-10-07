<script lang="ts">
	import Modal from '../Modal.svelte';

	let {
		dirty = false,
		obscured = false,
		autofocusSecond = false,
		heading,
		label,
		onClose = () => {}
	}: {
		dirty?: boolean;
		obscured?: boolean;
		autofocusSecond?: boolean;
		heading?: string;
		label?: string;
		onClose?: () => void;
	} = $props();

	let open = $state(false);
</script>

<button type="button" onclick={() => (open = true)}>Open</button>
<Modal
	{open}
	isDirty={() => dirty}
	{obscured}
	{label}
	onClose={() => {
		open = false;
		onClose();
	}}
>
	{#snippet headerExtra()}<span>Header extra</span>{/snippet}
	{#if heading}<h2>{heading}</h2>{/if}
	<input name="first" aria-label="First field" />
	<input
		name="second"
		aria-label="Second field"
		data-autofocus={autofocusSecond ? '' : undefined}
	/>
	<button type="button">Last button</button>
</Modal>
