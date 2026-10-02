import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Keyboard } from '@rogueserenity/kbdb-api-client';
import KeyboardDetails from './KeyboardDetails.svelte';

describe('KeyboardDetails.svelte', () => {
	it('reports an image that fails to load', async () => {
		const keyboard: Keyboard = {
			id: 'k',
			brand: 'KBDFans',
			name: 'Agar',
			images: [{ imageId: 'i1', url: 'data:image/png;base64,bm90IGFuIGltYWdl' }]
		};
		const onImageError = vi.fn();
		render(KeyboardDetails, { keyboard, onImageClick: vi.fn(), onImageError, showPrice: true });

		await vi.waitFor(() => expect(onImageError).toHaveBeenCalled());
	});
});
