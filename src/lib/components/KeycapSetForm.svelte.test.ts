import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KeycapSetForm from './KeycapSetForm.svelte';

describe('KeycapSetForm.svelte', () => {
	it('does not submit the form when Enter is pressed in a text field', async () => {
		const onSubmit = vi.fn();
		render(KeycapSetForm, { saving: false, error: null, onSubmit, onCancel: () => {} });

		const brand = page.getByLabelText('Brand *', { exact: false });
		await brand.fill('Drop');
		await brand.click();
		await userEvent.keyboard('{Enter}');

		expect(onSubmit).not.toHaveBeenCalled();
	});
});
