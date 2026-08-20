import { createClient } from '@workos-inc/authkit-js';
import { PUBLIC_WORKOS_CLIENT_ID } from '$env/static/public';

type AuthClient = Awaited<ReturnType<typeof createClient>>;

let clientPromise: Promise<AuthClient> | undefined;

/**
 * Lazily creates a single shared AuthKit client for the app. AuthKit's
 * `createClient` does its own redirect-callback handling on load, so this
 * must only ever run once per page load.
 */
export function getAuthClient(): Promise<AuthClient> {
	if (!clientPromise) {
		clientPromise = createClient(PUBLIC_WORKOS_CLIENT_ID, {
			redirectUri: `${window.location.origin}/auth/callback`
		});
	}
	return clientPromise;
}
