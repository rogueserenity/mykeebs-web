import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Keyboard } from '@rogueserenity/kbdb-api-client';
import KeyboardDetails from './KeyboardDetails.svelte';

const BROKEN = 'data:image/png;base64,bm90IGFuIGltYWdl';
const FRESH =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

function keyboard(url: string): Keyboard {
	return { id: 'k', brand: 'KBDFans', name: 'Agar', images: [{ imageId: 'i1', url }] };
}

describe('KeyboardDetails.svelte', () => {
	it('hides an image that fails to load and reports it', async () => {
		const onImageError = vi.fn();
		render(KeyboardDetails, {
			keyboard: keyboard(BROKEN),
			onImageClick: vi.fn(),
			onImageError,
			showPrice: true
		});

		await vi.waitFor(() => expect(onImageError).toHaveBeenCalledOnce());
		await expect.element(page.getByRole('img', { name: 'Agar' })).not.toBeInTheDocument();
	});

	it('shows the image again once a refetch brings a fresh URL', async () => {
		const onImageError = vi.fn();
		const { rerender } = render(KeyboardDetails, {
			keyboard: keyboard(BROKEN),
			onImageClick: vi.fn(),
			onImageError,
			showPrice: true
		});
		await vi.waitFor(() => expect(onImageError).toHaveBeenCalledOnce());

		await rerender({ keyboard: keyboard(FRESH) });

		await expect.element(page.getByRole('img', { name: 'Agar' })).toBeInTheDocument();
		expect(onImageError).toHaveBeenCalledOnce();
	});
});
