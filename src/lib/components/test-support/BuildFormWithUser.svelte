<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import { setUserContext } from '$lib/user-context';
	import BuildForm from '../BuildForm.svelte';

	let { formProps }: { formProps: ComponentProps<typeof BuildForm> } = $props();

	setUserContext({
		userId: 'user-1',
		username: 'tester',
		profile: { userId: 'user-1', username: 'tester' },
		isOwnProfile: true,
		showPrice: true
	});
</script>

<BuildForm {...formProps} />
