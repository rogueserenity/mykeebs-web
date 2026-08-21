import { StytchClient } from '@stytch/vanilla-js';
import { PUBLIC_STYTCH_PUBLIC_TOKEN } from '$env/static/public';

let client: StytchClient | undefined;

/**
 * Lazily creates a single shared Stytch client for the app. Cheap to
 * construct (unlike AuthKit's createClient, this doesn't do any
 * redirect-callback handling itself), but kept as a singleton for
 * consistency with the rest of the auth module's async accessor shape.
 */
export function getAuthClient(): StytchClient {
	if (!client) {
		client = new StytchClient(PUBLIC_STYTCH_PUBLIC_TOKEN);
	}
	return client;
}
