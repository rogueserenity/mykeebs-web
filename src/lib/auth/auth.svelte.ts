import { SvelteURLSearchParams } from 'svelte/reactivity';
import { PUBLIC_STYTCH_CLIENT_ID } from '$env/static/public';
import { getAuthClient } from './client';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';

// Discovered once via
// GET https://auth.jay.mykeebs.dev/.well-known/openid-configuration;
// hardcoded rather than fetched at runtime since these endpoints are
// stable infrastructure, not per-session data.
//
// authorization_endpoint is kbdb's own hosted consent page (kbdb's
// internal/consent, on its api.jay.mykeebs.dev custom domain), not a
// path under the auth.jay.mykeebs.dev issuer - Stytch's Connected Apps
// requires the app to host its own consent UI (there's no fully-hosted
// login domain the way WorkOS's AuthKit provided), so kbdb's dashboard
// "Authorization URL" setting points there instead of at Stytch itself.
const AUTHORIZE_ENDPOINT = 'https://api.jay.mykeebs.dev/authorize';
const TOKEN_ENDPOINT = 'https://auth.jay.mykeebs.dev/v1/oauth2/token';

const CODE_VERIFIER_KEY = 'stytch_pkce_code_verifier';
const ACCESS_TOKEN_KEY = 'stytch_access_token';

type User = { id: string; email: string | null };
type AuthState =
	{ status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User };

let state = $state<AuthState>({ status: 'loading' });
let initPromise: Promise<void> | undefined;

function decodeAccessToken(token: string): User {
	const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
	return { id: payload.sub, email: payload.email ?? null };
}

function syncFromStoredToken() {
	const token = localStorage.getItem(ACCESS_TOKEN_KEY);
	state = token
		? { status: 'signed-in', user: decodeAccessToken(token) }
		: { status: 'signed-out' };
}

/**
 * Initializes auth once for the app. Safe to call from multiple
 * components/layouts - subsequent calls reuse the same in-flight promise.
 */
export function initAuth(): Promise<void> {
	if (!initPromise) {
		initPromise = Promise.resolve().then(syncFromStoredToken);
	}
	return initPromise;
}

/**
 * Redirects to kbdb's hosted Stytch consent page to begin the
 * Authorization Code + PKCE flow. Completed by exchangeCodeForToken on
 * return to /auth/callback.
 */
export async function signIn(): Promise<void> {
	const verifier = generateCodeVerifier();
	const challenge = await generateCodeChallenge(verifier);
	localStorage.setItem(CODE_VERIFIER_KEY, verifier);

	const redirectUri = `${window.location.origin}/auth/callback`;
	const params = new SvelteURLSearchParams({
		client_id: PUBLIC_STYTCH_CLIENT_ID,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		code_challenge: challenge,
		code_challenge_method: 'S256'
	});

	window.location.assign(`${AUTHORIZE_ENDPOINT}?${params.toString()}`);
}

/**
 * Exchanges the ?code=... query param from the /auth/callback redirect
 * for an access token, using the code_verifier stashed in signIn.
 * Called once, from the /auth/callback route.
 */
export async function exchangeCodeForToken(code: string): Promise<void> {
	const verifier = localStorage.getItem(CODE_VERIFIER_KEY);
	if (!verifier) {
		throw new Error('No PKCE code_verifier found - signIn() was not called in this browser');
	}
	localStorage.removeItem(CODE_VERIFIER_KEY);

	const redirectUri = `${window.location.origin}/auth/callback`;
	const response = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new SvelteURLSearchParams({
			grant_type: 'authorization_code',
			client_id: PUBLIC_STYTCH_CLIENT_ID,
			code,
			code_verifier: verifier,
			redirect_uri: redirectUri
		})
	});

	if (!response.ok) {
		throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
	}

	const { access_token } = (await response.json()) as { access_token: string };
	localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
	syncFromStoredToken();
}

export const auth = {
	get status() {
		return state.status;
	},
	get user() {
		return state.status === 'signed-in' ? state.user : null;
	}
};

export async function signOut(): Promise<void> {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
	syncFromStoredToken();
	// Revokes the underlying Stytch session, if one exists (e.g. from the
	// magic-link login used on kbdb's consent page) - best-effort, since
	// signing out of mykeebs-web should succeed even if there's no active
	// Stytch session to revoke.
	await getAuthClient()
		.session.revoke()
		.catch(() => {});
}

/**
 * Access token for the generated API client's `accessToken` config. No
 * refresh handling yet - Connected Apps access tokens are short-lived
 * (1hr default); a 401 from kbdb should prompt re-signIn() until refresh
 * is added.
 */
export async function getAccessToken(): Promise<string> {
	const token = localStorage.getItem(ACCESS_TOKEN_KEY);
	if (!token) {
		throw new Error('Not signed in');
	}
	return token;
}
