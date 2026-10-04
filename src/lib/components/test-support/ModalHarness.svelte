<script lang="ts">
	import Modal from '../Modal.svelte';

	let {
		dirty = false,
		obscured = false,
		autofocusSecond = false,
		onClose = () => {}
	}: {
		dirty?: boolean;
		obscured?: boolean;
		autofocusSecond?: boolean;
		onClose?: () => void;
	} = $props();

	let open = $state(false);
</script>

<button type="button" onclick={() => (open = true)}>Open</button>
<Modal
	{open}
	{dirty}
	{obscured}
	onClose={() => {
		open = false;
		onClose();
	}}
>
	{#snippet headerExtra()}<span>Header extra</span>{/snippet}
	<input aria-label="First field" />
	<input aria-label="Second field" data-autofocus={autofocusSecond ? '' : undefined} />
	<button type="button">Last button</button>
</Modal>
