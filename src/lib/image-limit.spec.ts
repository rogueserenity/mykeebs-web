import { describe, expect, it } from 'vitest';
import { limitNotice, MAX_IMAGES, takeWithinLimit } from './image-limit';

describe('takeWithinLimit', () => {
	it('accepts everything that fits', () => {
		expect(takeWithinLimit(['a', 'b'], 3)).toEqual({ accepted: ['a', 'b'], skipped: 0 });
	});

	it('keeps the first picks that fit and counts the rest as skipped', () => {
		expect(takeWithinLimit(['a', 'b', 'c'], MAX_IMAGES - 2)).toEqual({
			accepted: ['a', 'b'],
			skipped: 1
		});
	});

	it('accepts nothing once the limit is reached', () => {
		expect(takeWithinLimit(['a'], MAX_IMAGES)).toEqual({ accepted: [], skipped: 1 });
	});

	it('treats a count already over the limit as full', () => {
		expect(takeWithinLimit(['a'], MAX_IMAGES + 3)).toEqual({ accepted: [], skipped: 1 });
	});
});

describe('limitNotice', () => {
	it('names the limit and how many were left out', () => {
		expect(limitNotice(3)).toBe('Up to 10 photos are allowed, so 3 were not added.');
	});

	it('uses the singular for one', () => {
		expect(limitNotice(1)).toBe('Up to 10 photos are allowed, so 1 was not added.');
	});
});
