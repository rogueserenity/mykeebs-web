import type { Profile, ProfileInput } from '@rogueserenity/kbdb-api-client';
import { ResponseError } from '@rogueserenity/kbdb-api-client';
import { auth } from '$lib/auth/auth.svelte';
import { profilesApi } from '$lib/api/client';

// The signed-in user's own profile, fetched once per sign-in via
// getProfile(auth.user.id). A user may not have a profile yet (status
// 'none') - the edit page doubles as the create flow in that case.
type ProfileState =
	| { status: 'idle' }
	| { status: 'loading' }
	| { status: 'none' }
	| { status: 'ready'; profile: Profile }
	| { status: 'error' };

let state = $state<ProfileState>({ status: 'idle' });
let loadedForUserId: string | undefined;

async function load(userId: string): Promise<void> {
	state = { status: 'loading' };
	try {
		const profile = await profilesApi.getProfile({ identifier: userId });
		state = { status: 'ready', profile };
	} catch (err) {
		if (err instanceof ResponseError && err.response.status === 404) {
			state = { status: 'none' };
		} else {
			state = { status: 'error' };
		}
	}
}

/**
 * Keeps the store in sync with auth: loads the profile when a user signs
 * in, clears it on sign-out. Call once from the root layout's onMount.
 */
export function initProfile(): void {
	$effect.root(() => {
		$effect(() => {
			const userId = auth.user?.id;
			if (!userId) {
				state = { status: 'idle' };
				loadedForUserId = undefined;
				return;
			}
			if (userId === loadedForUserId) return;
			loadedForUserId = userId;
			load(userId);
		});
	});
}

/** Re-fetches the current user's profile (after an edit or avatar change). */
export async function refreshProfile(): Promise<void> {
	const userId = auth.user?.id;
	if (userId) await load(userId);
}

/**
 * Creates or replaces the current user's profile, depending on whether
 * one already exists, and updates the store with the result. Lets the
 * caller handle ResponseError (409 username-unavailable, etc.).
 */
export async function saveProfile(input: ProfileInput): Promise<Profile> {
	const userId = auth.user?.id;
	if (!userId) throw new Error('Not signed in');

	const existing = state.status === 'ready';
	const profile = existing
		? await profilesApi.updateProfile({ identifier: userId, profileInput: input })
		: await profilesApi.createProfile({ identifier: userId, profileInput: input });
	state = { status: 'ready', profile };
	return profile;
}

export const profile = {
	get status() {
		return state.status;
	},
	get data() {
		return state.status === 'ready' ? state.profile : null;
	}
};
