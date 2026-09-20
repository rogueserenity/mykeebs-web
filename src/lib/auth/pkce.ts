// PKCE (RFC 7636) hand-rolled against Web Crypto: Stytch's SDK ships no
// OAuth-client helper, only third-party social login.

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return base64UrlEncode(new Uint8Array(digest));
}

// The OAuth `state` parameter (RFC 6749 §10.12) is the same shape as a PKCE
// verifier - 32 bytes of CSPRNG output, base64url - so it shares the generator.
export { generateCodeVerifier as generateState };
