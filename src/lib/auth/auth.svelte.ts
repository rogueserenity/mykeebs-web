import { SvelteURLSearchParams } from 'svelte/reactivity';
import { PUBLIC_STYTCH_CLIENT_ID } from '$env/static/public';
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
const LOGOUT_ENDPOINT = 'https://api.jay.mykeebs.dev/logout';
const TOKEN_ENDPOINT = 'https://auth.jay.mykeebs.dev/v1/oauth2/token';

const CODE_VERIFIER_KEY = 'stytch_pkce_code_verifier';
const ACCESS_TOKEN_KEY = 'stytch_access_token';
const REFRESH_TOKEN_KEY = 'stytch_refresh_token';

// Refresh this many seconds before actual expiry, to cover request latency.
const REFRESH_SKEW_SECONDS = 60;

type User = { id: string; email: string | null };
type AuthState =
	{ status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User };

let state = $state<AuthState>({ status: 'loading' });
let initPromise: Promise<void> | undefined;

function decodeAccessTokenPayload(token: string): { sub: string; email?: string; exp: number } {
	return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
}

function decodeAccessToken(token: string): User {
	const payload = decodeAccessTokenPayload(token);
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
		scope: 'openid email profile offline_access',
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

	const { access_token, refresh_token } = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
	};
	localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
	if (refresh_token) {
		localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
	}
	syncFromStoredToken();
}

/**
 * Exchanges the stored refresh token for a new access token (and, since
 * this is a public PKCE client, a rotated refresh token that must replace
 * the old one). Throws if there's no refresh token or the exchange fails -
 * callers should fall back to signIn() in that case.
 */
async function refreshAccessToken(): Promise<string> {
	const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
	if (!refreshToken) {
		throw new Error('No refresh token available');
	}

	const response = await fetch(TOKEN_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new SvelteURLSearchParams({
			grant_type: 'refresh_token',
			client_id: PUBLIC_STYTCH_CLIENT_ID,
			refresh_token: refreshToken
		})
	});

	if (!response.ok) {
		localStorage.removeItem(ACCESS_TOKEN_KEY);
		localStorage.removeItem(REFRESH_TOKEN_KEY);
		syncFromStoredToken();
		throw new Error(`Token refresh failed: ${response.status} ${await response.text()}`);
	}

	const { access_token, refresh_token } = (await response.json()) as {
		access_token: string;
		refresh_token?: string;
	};
	localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
	if (refresh_token) {
		localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
	}
	syncFromStoredToken();
	return access_token;
}

export const auth = {
	get status() {
		return state.status;
	},
	get user() {
		return state.status === 'signed-in' ? state.user : null;
	}
};

/**
 * The Stytch session lives on kbdb's origin, not this one (it was created
 * there, on kbdb's own consent page) - revoking it has to happen there too,
 * so this navigates through kbdb's /logout rather than calling
 * session.revoke() on a client that was never actually signed in.
 */
export function signOut(): void {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
	localStorage.removeItem(REFRESH_TOKEN_KEY);
	syncFromStoredToken();

	const params = new SvelteURLSearchParams({ return_to: window.location.origin });
	window.location.assign(`${LOGOUT_ENDPOINT}?${params.toString()}`);
}

/**
 * Access token for the generated API client's `accessToken` config -
 * called per-request, so this is where transparent refresh happens.
 * Refreshes ahead of expiry using the stored refresh token (requested via
 * the offline_access scope in signIn()); if that fails (or there's no
 * refresh token, e.g. a session from before this was added), the caller
 * gets whatever's stored and a subsequent 401 should prompt re-signIn().
 *
 * Returns '' when signed out rather than throwing - the generated client
 * only sets the Authorization header when this resolves truthy, so an
 * empty string lets anonymous-allowed endpoints (e.g. GET profile,
 * GET /profiles) still fire their request instead of failing before the
 * fetch ever goes out.
 */
export async function getAccessToken(): Promise<string> {
	const token = localStorage.getItem(ACCESS_TOKEN_KEY);
	if (!token) {
		return '';
	}

	const { exp } = decodeAccessTokenPayload(token);
	const expiresInSeconds = exp - Date.now() / 1000;
	if (expiresInSeconds > REFRESH_SKEW_SECONDS) {
		return token;
	}

	if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
		// No refresh token (e.g. a session from before this was added) -
		// fall back to the stale token; a 401 should prompt re-signIn().
		return token;
	}

	return await refreshAccessToken();
}
