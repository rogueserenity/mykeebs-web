import { page, userEvent } from 'vitest/browser';
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

describe('ImageViewer.svelte as a dialog', () => {
	it('is a dialog named after the photo, with focus on Close', async () => {
		render(ImageViewer, base);

		await expect
			.element(page.getByRole('dialog', { name: 'Neo65 Cu, full size' }))
			.toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Close' })).toHaveFocus();
	});

	it('keeps Tab inside the viewer, wrapping at both ends', async () => {
		render(ImageViewer, { ...base, onPrev: () => {}, onNext: () => {} });
		await expect.element(page.getByRole('button', { name: 'Close' })).toHaveFocus();

		await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
		await expect.element(page.getByRole('button', { name: 'Next photo' })).toHaveFocus();

		await userEvent.keyboard('{Tab}');
		await expect.element(page.getByRole('button', { name: 'Close' })).toHaveFocus();
	});

	it('returns focus to whatever was focused before it opened', async () => {
		const opener = document.createElement('button');
		opener.textContent = 'Open photo';
		document.body.append(opener);
		opener.focus();
		const { rerender } = render(ImageViewer, { ...base, open: false });

		await rerender({ ...base, open: true });
		await expect.element(page.getByRole('button', { name: 'Close' })).toHaveFocus();
		await rerender({ ...base, open: false });

		expect(document.activeElement).toBe(opener);
		opener.remove();
	});
});
