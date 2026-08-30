<script lang="ts">
	import { resolve } from '$app/paths';
	import { auth, signOut } from '$lib/auth/auth.svelte';
	import { profile } from '$lib/profile/profile.svelte';
	import Avatar from '$lib/components/Avatar.svelte';

	// Falls back to the auth email's local part until the profile loads (or
	// if the user has no profile yet).
	let displayName = $derived(profile.data?.username ?? auth.user?.email?.split('@')[0] ?? 'you');
	let hasProfile = $derived(profile.status === 'ready');

	let open = $state(false);
	let menuEl = $state<HTMLDivElement | null>(null);

	function handleDocumentClick(event: MouseEvent) {
		if (open && menuEl && !menuEl.contains(event.target as Node)) {
			open = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') open = false;
	}
</script>

<svelte:window onclick={handleDocumentClick} onkeydown={open ? handleKeydown : undefined} />

<div class="relative" bind:this={menuEl}>
	<button
		type="button"
		class="profile-trigger"
		aria-haspopup="menu"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<Avatar name={displayName} imageUrl={profile.data?.avatar?.url} size="sm" />
		<span class="font-mono text-sm">{displayName}</span>
	</button>

	{#if open}
		<div class="profile-menu" role="menu">
			<div class="flex items-center gap-3 px-2 pb-3">
				<Avatar name={displayName} imageUrl={profile.data?.avatar?.url} size="lg" />
				<div class="min-w-0">
					<p class="heading-lg truncate text-sm">
						{#if hasProfile}@{displayName}{:else}{displayName}{/if}
					</p>
					{#if profile.data?.discordUsername}
						<p class="text-faint truncate font-mono text-xs">{profile.data.discordUsername}</p>
					{/if}
				</div>
			</div>
			{#if !hasProfile}
				<div class="profile-menu-divider"></div>
				<a href={resolve('/profile/edit')} class="profile-menu-item" role="menuitem">
					Set up your profile
				</a>
			{/if}
			<div class="profile-menu-divider"></div>
			<button
				type="button"
				class="profile-menu-item"
				role="menuitem"
				onclick={() => {
					open = false;
					signOut();
				}}
			>
				Sign out
			</button>
		</div>
	{/if}
</div>
