import type { User } from '@workos-inc/authkit-js';
import { getAuthClient } from './client';

type AuthState =
	{ status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User };

let state = $state<AuthState>({ status: 'loading' });
let initPromise: Promise<void> | undefined;

function syncFromClient(user: User | null) {
	state = user ? { status: 'signed-in', user } : { status: 'signed-out' };
}

/**
 * Initializes AuthKit once for the app. Safe to call from multiple
 * components/layouts - subsequent calls reuse the same in-flight promise.
 */
export function initAuth(): Promise<void> {
	if (!initPromise) {
		initPromise = getAuthClient().then((client) => {
			syncFromClient(client.getUser());
		});
	}
	return initPromise;
}

export const auth = {
	get status() {
		return state.status;
	},
	get user() {
		return state.status === 'signed-in' ? state.user : null;
	}
};

export async function signIn(): Promise<void> {
	const client = await getAuthClient();
	await client.signIn();
}

export async function signUp(): Promise<void> {
	const client = await getAuthClient();
	await client.signUp();
}

export async function signOut(): Promise<void> {
	const client = await getAuthClient();
	client.signOut();
}

/**
 * Access token for the generated API client's `accessToken` config -
 * AuthKit refreshes it transparently before expiry.
 */
export async function getAccessToken(): Promise<string> {
	const client = await getAuthClient();
	return client.getAccessToken();
}
