import { describe, expect, it } from 'vitest';
import { fitWithin, MAX_EDGE, webpName } from './image-resize';

describe('fitWithin', () => {
	it('scales a landscape image so its width is the max edge', () => {
		expect(fitWithin(4032, 3024)).toEqual({ width: MAX_EDGE, height: 1920 });
	});

	it('scales a portrait image so its height is the max edge', () => {
		expect(fitWithin(3024, 4032)).toEqual({ width: 1920, height: MAX_EDGE });
	});

	it('never enlarges an image already within the max edge', () => {
		expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
	});

	it('keeps an image exactly at the max edge unchanged', () => {
		expect(fitWithin(MAX_EDGE, 100)).toEqual({ width: MAX_EDGE, height: 100 });
	});

	it('never rounds a thin side down to zero', () => {
		expect(fitWithin(100000, 10)).toEqual({ width: MAX_EDGE, height: 1 });
	});
});

describe('webpName', () => {
	it('swaps the extension for .webp', () => {
		expect(webpName('IMG_1234.HEIC')).toBe('IMG_1234.webp');
	});

	it('only replaces the last extension', () => {
		expect(webpName('kit.base.png')).toBe('kit.base.webp');
	});

	it('adds .webp when there is no extension', () => {
		expect(webpName('photo')).toBe('photo.webp');
	});

	it('falls back to a name when the original is only an extension', () => {
		expect(webpName('.png')).toBe('image.webp');
	});
});
