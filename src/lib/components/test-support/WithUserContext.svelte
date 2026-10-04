<script lang="ts">
	import type { Component } from 'svelte';
	import { setUserContext } from '$lib/user-context';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let { component: Inner }: { component: Component<any> } = $props();

	setUserContext({
		userId: 'user-1',
		username: 'rogue.serenity',
		profile: { userId: 'user-1', username: 'rogue.serenity', discoverable: true },
		isOwnProfile: true,
		showPrice: true
	});
</script>

<Inner />
