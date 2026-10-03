<script lang="ts">
	import type { Component } from 'svelte';

	let {
		form: Form,
		formProps
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: { form: Component<any>; formProps: Record<string, unknown> } = $props();

	let dirty = $state(false);
</script>

<Form {...formProps} bind:dirty />
<output data-testid="dirty">{dirty}</output>
