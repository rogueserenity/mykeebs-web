import { describe, expect, it } from 'vitest';
import { stepIndex } from './step-index';

describe('stepIndex', () => {
	it('steps forward and back', () => {
		expect(stepIndex(0, 1, 3)).toBe(1);
		expect(stepIndex(2, -1, 3)).toBe(1);
	});

	it('wraps around at either end', () => {
		expect(stepIndex(2, 1, 3)).toBe(0);
		expect(stepIndex(0, -1, 3)).toBe(2);
	});
});
