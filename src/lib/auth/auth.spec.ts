import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeStateMatches } from './auth.svelte';

const STATE_KEY = 'stytch_oauth_state';

beforeEach(() => {
	const store = new Map<string, string>();
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	});
});

describe('consumeStateMatches', () => {
	it('accepts the state it stored', () => {
		localStorage.setItem(STATE_KEY, 'abc123');
		expect(consumeStateMatches('abc123')).toBe(true);
	});

	it('rejects a state the attacker picked', () => {
		localStorage.setItem(STATE_KEY, 'abc123');
		expect(consumeStateMatches('attacker')).toBe(false);
	});

	// The bare-callback case: no flow was ever started in this browser.
	it('rejects when nothing was stored', () => {
		expect(consumeStateMatches('abc123')).toBe(false);
	});

	// Omitting the param entirely must not read as "no check needed".
	it('rejects a missing state', () => {
		localStorage.setItem(STATE_KEY, 'abc123');
		expect(consumeStateMatches(null)).toBe(false);
	});

	it('rejects when neither side has a state', () => {
		expect(consumeStateMatches(null)).toBe(false);
	});

	// Single-use: a replayed redirect finds nothing left to match.
	it('consumes the state, so a replay fails', () => {
		localStorage.setItem(STATE_KEY, 'abc123');
		expect(consumeStateMatches('abc123')).toBe(true);
		expect(consumeStateMatches('abc123')).toBe(false);
	});
});
