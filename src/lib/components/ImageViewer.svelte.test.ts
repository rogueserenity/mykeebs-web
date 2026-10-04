import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ImageViewer from './ImageViewer.svelte';

const base = { open: true, src: 'https://img.example/1.png', alt: 'Neo65 Cu', onClose: () => {} };

describe('ImageViewer.svelte arrows', () => {
	it('names the arrows for photos by default and steps with them', async () => {
		const onPrev = vi.fn();
		const onNext = vi.fn();
		render(ImageViewer, { ...base, onPrev, onNext });

		await page.getByRole('button', { name: 'Previous photo' }).click();
		await page.getByRole('button', { name: 'Next photo' }).click();

		expect(onPrev).toHaveBeenCalledOnce();
		expect(onNext).toHaveBeenCalledOnce();
	});

	it('names the arrows after what is being browsed', async () => {
		render(ImageViewer, { ...base, itemLabel: 'kit', onPrev: () => {}, onNext: () => {} });

		await expect.element(page.getByRole('button', { name: 'Previous kit' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Next kit' })).toBeInTheDocument();
	});

	it('shows no arrows when there is nothing to step to', async () => {
		render(ImageViewer, base);

		await expect.element(page.getByRole('button', { name: 'Close' })).toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: /^(Previous|Next) / }))
			.not.toBeInTheDocument();
	});
});
