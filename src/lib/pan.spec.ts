import { describe, expect, it } from 'vitest';
import { clampOffset } from './pan';

describe('clampOffset', () => {
	it('allows moving up to the point where the zoomed edge meets the viewport edge', () => {
		// 800px image at 2x is 1600px; in a 1000px viewport, 300px hangs over each side.
		expect(clampOffset(250, 800, 2, 1000)).toBe(250);
		expect(clampOffset(400, 800, 2, 1000)).toBe(300);
		expect(clampOffset(-400, 800, 2, 1000)).toBe(-300);
	});

	it('keeps the image centered when the zoomed image still fits', () => {
		expect(clampOffset(120, 400, 2, 1000)).toBe(0);
		expect(clampOffset(-120, 400, 2, 1000)).toBe(0);
	});
});
