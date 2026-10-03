import { describe, expect, it } from 'vitest';
import type { Build } from '@rogueserenity/kbdb-api-client';
import { primaryBuildImageUrl } from './build';

function build(urls?: string[]): Build {
	return {
		id: 'b',
		keyboardId: 'kb',
		images: urls?.map((url, i) => ({ imageId: `i${i}`, url }))
	};
}

describe('primaryBuildImageUrl', () => {
	it("is the build's first image", () => {
		expect(primaryBuildImageUrl(build(['first.png', 'second.png']))).toBe('first.png');
	});

	it('is undefined for a build with no images', () => {
		expect(primaryBuildImageUrl(build([]))).toBeUndefined();
		expect(primaryBuildImageUrl(build())).toBeUndefined();
	});
});
