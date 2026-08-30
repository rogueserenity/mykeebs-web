<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { auth } from '$lib/auth/auth.svelte';
	import { profile } from '$lib/profile/profile.svelte';

	$effect(() => {
		if (auth.status === 'loading' || profile.status === 'loading' || profile.status === 'idle') {
			return;
		}
		if (profile.status === 'ready') {
			goto(resolve('/u/[username]/keyboards', { username: profile.data!.username }), {
				replaceState: true
			});
		} else if (profile.status === 'none') {
			goto(resolve('/profile/edit'), { replaceState: true });
		} else {
			goto(resolve('/discover'), { replaceState: true });
		}
	});
</script>
