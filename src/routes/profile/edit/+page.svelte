<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ProfileInput, ProfileLink } from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { profile, saveProfile, refreshProfile } from '$lib/profile/profile.svelte';
	import { profilesApi } from '$lib/api/client';
	import Avatar from '$lib/components/Avatar.svelte';

	// Lowercase letters, digits, hyphen, period, underscore; 3-32 chars; no
	// leading/trailing separator; no consecutive periods. Mirrors ProfileInput.username.
	const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/;
	const MAX_LINKS = 5;

	// Seeded from the store once it resolves. Editing an existing profile
	// pre-fills; a brand-new profile (status 'none') starts blank and this
	// page's submit creates it.
	let username = $state('');
	let discordUsername = $state('');
	let bio = $state('');
	let discoverable = $state(false);
	let links = $state<ProfileLink[]>([]);

	let seeded = false;
	$effect(() => {
		if (seeded) return;
		if (profile.status === 'ready') {
			const p = profile.data!;
			username = p.username;
			discordUsername = p.discordUsername ?? '';
			bio = p.bio ?? '';
			discoverable = p.discoverable ?? false;
			links = (p.links ?? []).map((l) => ({ ...l }));
			seeded = true;
		} else if (profile.status === 'none') {
			seeded = true;
		}
	});

	let isNew = $derived(profile.status === 'none');
	let saving = $state(false);
	let formError = $state<string | null>(null);
	let usernameError = $state<string | null>(null);

	let usernameLooksValid = $derived(
		USERNAME_PATTERN.test(username) && !username.includes('..') && !username.startsWith('user-')
	);

	function addLink() {
		if (links.length < MAX_LINKS) links = [...links, { name: '', url: '' }];
	}

	function removeLink(index: number) {
		links = links.filter((_, i) => i !== index);
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		formError = null;
		usernameError = null;

		if (!usernameLooksValid) {
			usernameError =
				'3–32 chars: lowercase letters, digits, hyphen, period, underscore. No leading/trailing or consecutive periods/hyphens/underscores. Cannot start with "user-".';
			return;
		}

		const cleanedLinks = links
			.map((l) => ({ name: l.name.trim(), url: l.url.trim() }))
			.filter((l) => l.name || l.url);
		if (cleanedLinks.some((l) => !l.name || !l.url)) {
			formError = 'Each link needs both a name and a URL.';
			return;
		}
		if (cleanedLinks.some((l) => !/^https:\/\//i.test(l.url))) {
			formError = 'Link URLs must start with https://.';
			return;
		}

		const input: ProfileInput = {
			username,
			discoverable,
			discordUsername: discordUsername.trim() || undefined,
			bio: bio.trim() || undefined,
			links: cleanedLinks.length > 0 ? cleanedLinks : undefined
		};

		saving = true;
		try {
			const saved = await saveProfile(input);
			goto(resolve('/u/[username]', { username: saved.username }));
		} catch (err) {
			if (err instanceof ResponseError && err.response.status === 409) {
				const body = await err.response.json().catch(() => null);
				if (body?.type?.includes('username-unavailable')) {
					usernameError = 'That username is already taken.';
				} else {
					formError = 'Your profile was changed elsewhere. Reload and try again.';
				}
			} else {
				formError = 'Could not save your profile.';
			}
		} finally {
			saving = false;
		}
	}

	// Avatar: allocate a presigned S3 PUT URL, upload the bytes to it, then
	// refresh the store to pick up the new avatar URL.
	let avatarBusy = $state(false);
	let avatarError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	async function onAvatarPick(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file || !auth.user) return;
		avatarError = null;
		avatarBusy = true;
		try {
			const { uploadUrl } = await profilesApi.setProfileImage({
				identifier: auth.user.id,
				imageUploadRequest: { contentType: file.type }
			});
			const put = await fetch(uploadUrl, {
				method: 'PUT',
				headers: { 'Content-Type': file.type },
				body: file
			});
			if (!put.ok) throw new Error(`upload failed: ${put.status}`);
			await refreshProfile();
		} catch {
			avatarError = 'Could not upload that image.';
		} finally {
			avatarBusy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	async function removeAvatar() {
		if (!auth.user) return;
		avatarError = null;
		avatarBusy = true;
		try {
			await profilesApi.deleteProfileImage({ identifier: auth.user.id });
			await refreshProfile();
		} catch {
			avatarError = 'Could not remove your photo.';
		} finally {
			avatarBusy = false;
		}
	}
</script>

<div class="mx-auto max-w-2xl px-4 py-10">
	{#if auth.status === 'loading' || profile.status === 'loading' || profile.status === 'idle'}
		<p class="text-muted p-16 text-center font-mono text-sm tracking-wide">Loading&hellip;</p>
	{:else if auth.status === 'signed-out'}
		<p class="text-muted p-16 text-center text-lg">Sign in to edit your profile.</p>
	{:else if profile.status === 'error'}
		<p class="p-16 text-center text-lg" style="color: var(--danger)">
			Could not load your profile.
		</p>
	{:else}
		<h1 class="heading-lg text-2xl">{isNew ? "Let's set up your profile" : 'Edit profile'}</h1>
		<p class="text-muted mt-1 text-sm">
			{isNew
				? "Pick a username to get started - that's the only thing you need right now."
				: 'Update how you appear to other collectors.'}
		</p>

		<div class="mt-8 flex items-center gap-4">
			<Avatar name={username || 'you'} imageUrl={profile.data?.avatar?.url} size="lg" />
			<div class="flex flex-col gap-2">
				<div class="flex gap-2">
					<button
						type="button"
						class="btn"
						disabled={isNew || avatarBusy}
						onclick={() => fileInput?.click()}
					>
						{avatarBusy ? 'Working…' : 'Change photo'}
					</button>
					{#if profile.data?.avatar?.url}
						<button type="button" class="btn" disabled={avatarBusy} onclick={removeAvatar}>
							Remove
						</button>
					{/if}
				</div>
				{#if isNew}
					<span class="text-faint text-xs">Save your profile first, then add a photo.</span>
				{/if}
				{#if avatarError}
					<span class="text-xs" style="color: var(--danger)">{avatarError}</span>
				{/if}
			</div>
			<input
				bind:this={fileInput}
				type="file"
				accept="image/*"
				class="hidden"
				onchange={onAvatarPick}
			/>
		</div>

		<form class="mt-8 flex flex-col gap-5" onsubmit={handleSubmit}>
			<label class="flex flex-col gap-1.5">
				<span class="section-label mb-0">Username <span style="color: var(--danger)">*</span></span>
				<input
					type="text"
					class="field-input font-mono"
					maxlength="32"
					bind:value={username}
					autocomplete="off"
				/>
				<span class="text-faint text-xs">
					Your profile will be at /u/{usernameLooksValid ? username : 'username'}
				</span>
				{#if usernameError}
					<span class="text-xs" style="color: var(--danger)">{usernameError}</span>
				{/if}
			</label>

			<label class="flex flex-col gap-1.5">
				<span class="section-label mb-0">Discord username</span>
				<input
					type="text"
					class="field-input font-mono"
					maxlength="32"
					placeholder="e.g. jayb"
					bind:value={discordUsername}
				/>
			</label>

			<label class="flex flex-col gap-1.5">
				<span class="section-label mb-0">Bio</span>
				<textarea class="field-input" rows="3" maxlength="500" bind:value={bio}></textarea>
				<span class="text-faint text-xs">{bio.length}/500</span>
			</label>

			<div class="flex flex-col gap-2">
				<span class="section-label mb-0">Links</span>
				{#each links as link, index (index)}
					<div class="flex gap-2">
						<input
							type="text"
							class="field-input w-1/3"
							placeholder="Label"
							maxlength="32"
							bind:value={link.name}
						/>
						<input
							type="url"
							class="field-input flex-1 font-mono"
							placeholder="https://…"
							bind:value={link.url}
						/>
						<button
							type="button"
							class="btn-icon"
							aria-label="Remove link"
							onclick={() => removeLink(index)}
						>
							✕
						</button>
					</div>
				{/each}
				{#if links.length < MAX_LINKS}
					<button type="button" class="btn self-start" onclick={addLink}>Add link</button>
				{/if}
			</div>

			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={discoverable} />
				<span class="text-sm">Make my profile discoverable</span>
			</label>
			<p class="text-faint -mt-3 text-xs">
				Others can find you in Discover and view /u/{usernameLooksValid ? username : 'username'}.
				Individual builds still use their own visibility setting.
			</p>

			{#if formError}
				<p class="text-sm" style="color: var(--danger)">{formError}</p>
			{/if}

			<div class="mt-2 flex gap-2">
				<button type="submit" class="btn btn-accent" disabled={saving}>
					{saving ? 'Saving…' : isNew ? 'Create profile' : 'Save changes'}
				</button>
			</div>
		</form>
	{/if}
</div>
