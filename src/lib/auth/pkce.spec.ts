import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier } from './pkce';

describe('generateCodeVerifier', () => {
	it('makes a 43-char base64url verifier from 32 random bytes', () => {
		expect(generateCodeVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	it('never repeats', () => {
		expect(generateCodeVerifier()).not.toBe(generateCodeVerifier());
	});
});

describe('generateCodeChallenge', () => {
	it('matches the RFC 7636 appendix B example', async () => {
		expect(await generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
			'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
		);
	});
});
