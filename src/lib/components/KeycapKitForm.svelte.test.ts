import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { KeycapKit, KeycapKitInput } from '@rogueserenity/kbdb-api-client';
import KeycapKitForm from './KeycapKitForm.svelte';
import FormWithDirty from './test-support/FormWithDirty.svelte';

const kit: KeycapKit = { kitId: 'kit-1', name: 'Base' };

async function submitted(isPrimary: boolean, toggle: boolean): Promise<KeycapKitInput> {
	const onSubmit = vi.fn();
	render(KeycapKitForm, {
		initial: kit,
		isPrimary,
		saving: false,
		error: null,
		onSubmit,
		onCancel: () => {}
	});
	if (toggle) await page.getByLabelText('Primary kit for this set').click();
	await page.getByRole('button', { name: 'Save changes' }).click();
	expect(onSubmit).toHaveBeenCalledOnce();
	return onSubmit.mock.calls[0][0];
}

describe('KeycapKitForm.svelte', () => {
	it("starts ticked for the set's primary kit", async () => {
		render(KeycapKitForm, {
			initial: kit,
			isPrimary: true,
			saving: false,
			error: null,
			onSubmit: () => {},
			onCancel: () => {}
		});
		await expect.element(page.getByLabelText('Primary kit for this set')).toBeChecked();
	});

	it('leaves primary out when an untouched kit is saved', async () => {
		const input = await submitted(false, false);
		expect(input.primary).toBeUndefined();
	});

	it('sends true when the box is ticked', async () => {
		const input = await submitted(false, true);
		expect(input.primary).toBe(true);
	});

	it('sends false when the primary kit is unticked', async () => {
		const input = await submitted(true, true);
		expect(input.primary).toBe(false);
	});
});

describe('KeycapKitForm.svelte cleared price', () => {
	function renderKit(initial: KeycapKit) {
		const onSubmit = vi.fn();
		render(FormWithDirty, {
			form: KeycapKitForm,
			formProps: { initial, saving: false, error: null, onSubmit, onCancel: () => {} }
		});
		return onSubmit;
	}

	it('leaves the form clean once the price is typed into and cleared', async () => {
		renderKit(kit);
		const dirty = page.getByTestId('dirty');

		await page.getByLabelText('Price').fill('5');
		await expect.element(dirty).toHaveTextContent('true');
		await page.getByLabelText('Price').fill('');

		await expect.element(dirty).toHaveTextContent('false');
	});

	it('drops a cleared price rather than keeping the old value', async () => {
		const onSubmit = renderKit({ ...kit, purchase: { vendor: 'NovelKeys', price: 120 } });

		await page.getByLabelText('Price').fill('');
		await page.getByRole('button', { name: 'Save changes' }).click();

		expect(onSubmit).toHaveBeenCalledOnce();
		expect(onSubmit.mock.calls[0][0].purchase?.price).toBeNullable();
	});
});
