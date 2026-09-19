import { SvelteURLSearchParams } from 'svelte/reactivity';
import { PUBLIC_STYTCH_CLIENT_ID } from '$env/static/public';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';

// AUTHORIZE/LOGOUT are kbdb's own hosted consent pages, not paths under the
// Stytch issuer: Connected Apps requires the app to host its own consent UI.
const AUTHORIZE_ENDPOINT = 'https://api.jay.mykeebs.dev/authorize';
const LOGOUT_ENDPOINT = 'https://api.jay.mykeebs.dev/logout';
const TOKEN_ENDPOINT = 'https://auth.jay.mykeebs.dev/v1/oauth2/token';

const CODE_VERIFIER_KEY = 'stytch_pkce_code_verifier';
const ACCESS_TOKEN_KEY = 'stytch_access_token';
const REFRESH_TOKEN_KEY = 'stytch_refresh_token';

const REFRESH_SKEW_SECONDS = 60;

type User = { id: string; email: string | null };
type AuthState =
	{ status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: User };

let state = $state<AuthState>({ status: 'loading' });
let initPromise: Promise<void> | undefined;

type AccessTokenPayload = { sub: string; email?: string; exp: number };

function decodeAccessTokenPayload(token: string): AccessTokenPayload | null {
	try {
		const segment = token.split('.')[1];
		if (!segment) return null;
		const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')));
		if (typeof payload?.sub !== 'string' || typeof payload?.exp !== 'number') return null;
		return payload;
	} catch {
		return null;
	}
}

function clearStoredTokens() {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
	localStorage.removeItem(REFRESH_TOKEN_KEY);
}

function syncFromStoredToken() {
	const token = localStorage.getItem(ACCESS_TOKEN_KEY);
	const payload = token ? decodeAccessTokenPayload(token) : null;
	if (token && !payload) clearStoredTokens();
	state = payload
		? { status: 'signed-in', user: { id: payload.sub, email: payload.email ?? null } }
		: { status: 'signed-out' };
}

export function initAuth(): Promise<void> {
	if (!initPromise) {
		initPromise = Promise.resolve().then(() => {
			try {
				syncFromStoredToken();
			} catch {
				state = { status: 'signed-out' };
			}
		});
	}
	return initPromise;
}

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

// Public PKCE client: Stytch rotates the refresh token on every exchange, so
// concurrent refreshes would each invalidate the others' token. Callers share
// one in-flight exchange instead.
let refreshInFlight: Promise<string> | undefined;

function refreshAccessToken(): Promise<string> {
	if (!refreshInFlight) {
		refreshInFlight = exchangeRefreshToken().finally(() => {
			refreshInFlight = undefined;
		});
	}
	return refreshInFlight;
}

async function exchangeRefreshToken(): Promise<string> {
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
		clearStoredTokens();
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

// The Stytch session lives on kbdb's origin, so revoking it has to happen
// there rather than via session.revoke() here.
export function signOut(): void {
	localStorage.removeItem(ACCESS_TOKEN_KEY);
	localStorage.removeItem(REFRESH_TOKEN_KEY);
	syncFromStoredToken();

	const params = new SvelteURLSearchParams({ return_to: window.location.origin });
	window.location.assign(`${LOGOUT_ENDPOINT}?${params.toString()}`);
}

// Called per-request by the generated client. Returns '' when signed out
// rather than throwing: the client only sets the Authorization header on a
// truthy value, which lets anonymous-allowed endpoints still fire.
export async function getAccessToken(): Promise<string> {
	const token = localStorage.getItem(ACCESS_TOKEN_KEY);
	if (!token) {
		return '';
	}

	const payload = decodeAccessTokenPayload(token);
	if (!payload) {
		clearStoredTokens();
		syncFromStoredToken();
		return '';
	}

	if (payload.exp - Date.now() / 1000 > REFRESH_SKEW_SECONDS) {
		return token;
	}

	if (!localStorage.getItem(REFRESH_TOKEN_KEY)) {
		return token;
	}

	return await refreshAccessToken();
}
