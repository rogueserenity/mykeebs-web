<script lang="ts">
	import type { Component } from 'svelte';

	let {
		form: Form,
		formProps
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	}: { form: Component<any, { isDirty(): boolean }>; formProps: Record<string, unknown> } =
		$props();

	let instance = $state<{ isDirty(): boolean } | null>(null);
</script>

<Form {...formProps} bind:this={instance} />
<output data-testid="dirty">{instance?.isDirty() ?? false}</output>
