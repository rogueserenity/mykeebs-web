import { describe, expect, it } from 'vitest';
import type { KeycapKit, KeycapSet } from '@rogueserenity/kbdb-api-client';
import { primaryKitImageUrl } from './keycap-set';

function kit(kitId: string, url?: string): KeycapKit {
	return { kitId, name: kitId, image: url ? { url } : undefined };
}

function set(primaryKitId: string | null | undefined, kits?: KeycapKit[]): KeycapSet {
	return { id: 's', brand: 'GMK', name: 'Olivia', primaryKitId, kits };
}

describe('primaryKitImageUrl', () => {
	it("returns the primary kit's image, not the first kit's", () => {
		expect(primaryKitImageUrl(set('base', [kit('novelties', 'n.png'), kit('base', 'b.png')]))).toBe(
			'b.png'
		);
	});

	it('is undefined when no primary kit is set', () => {
		expect(primaryKitImageUrl(set(null, [kit('base', 'b.png')]))).toBeUndefined();
		expect(primaryKitImageUrl(set(undefined, [kit('base', 'b.png')]))).toBeUndefined();
	});

	it('is undefined when the primary kit no longer exists', () => {
		expect(primaryKitImageUrl(set('deleted', [kit('base', 'b.png')]))).toBeUndefined();
	});

	it('is undefined when the primary kit has no image', () => {
		expect(primaryKitImageUrl(set('base', [kit('base')]))).toBeUndefined();
	});

	it('is undefined when the set has no kits', () => {
		expect(primaryKitImageUrl(set('base'))).toBeUndefined();
	});
});
