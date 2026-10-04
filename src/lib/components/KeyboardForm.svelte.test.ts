import { page, userEvent } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Visibility, type Keyboard, type KeyboardInput } from '@rogueserenity/kbdb-api-client';
import { lookupsApi } from '$lib/api/client';
import { todayDateInput } from '$lib/format';
import KeyboardForm from './KeyboardForm.svelte';
import FormWithDirty from './test-support/FormWithDirty.svelte';

vi.mock('$lib/api/client', () => ({ lookupsApi: { getLookup: vi.fn() } }));

const lookups: Record<string, unknown[]> = {
	keyboard_size: ['60%', '65%', 'TKL'],
	keyboard_layout: [
		{ name: 'ANSI', sizes: ['60%', '65%', 'TKL'] },
		{ name: 'HHKB', sizes: ['60%'] },
		{ name: 'Alice', sizes: ['65%'] }
	],
	keyboard_case_material: ['Aluminum', 'Polycarbonate'],
	keyboard_weight_material: ['Brass', 'Stainless steel'],
	keyboard_plate_material: ['FR4', 'POM', 'Aluminum'],
	keyboard_pcb_firmware: ['QMK', 'VIA'],
	keyboard_pcb_assembly_type: ['Hotswap', 'Solder'],
	keyboard_pcb_connectivity_type: ['Wired', 'Wireless'],
	vendor: ['CannonKeys', 'NovelKeys'],
	order_status: ['Planned', 'Ordered', 'Delivered']
};

const keyboard: Keyboard = {
	id: 'kb-1',
	brand: 'Bowl',
	name: 'Manta',
	size: '65%',
	layout: 'Alice',
	design: {
		topCase: { material: 'Aluminum', color: 'E-white' },
		bottomCase: { material: 'Polycarbonate' },
		weight: { material: 'Brass', color: 'Mirror' },
		plates: ['POM', 'Carbon fiber']
	},
	pcb: { thickness: 1.2, firmware: 'QMK', assembly: 'Hotswap', connectivity: 'Wired' },
	purchase: {
		vendor: 'Group buy direct',
		price: 450,
		orderDate: new Date('2026-01-15'),
		deliveryDate: new Date('2026-08-02'),
		orderStatus: 'Delivered'
	},
	notes: 'Endgame, allegedly.',
	visibility: Visibility.Public,
	images: [{ imageId: 'img-1', url: 'https://img.example/1.png' }]
};

function renderForm(props: Partial<Parameters<typeof KeyboardForm>[1]> = {}) {
	const mocks = { onSubmit: vi.fn(), onCancel: vi.fn() };
	render(FormWithDirty, {
		form: KeyboardForm,
		formProps: { saving: false, error: null, ...mocks, ...props }
	});
	return mocks;
}

async function submit(name = 'Add keyboard') {
	await page.getByRole('button', { name }).click();
}

function submitted(onSubmit: ReturnType<typeof vi.fn>): [KeyboardInput, File[] | undefined] {
	expect(onSubmit).toHaveBeenCalledOnce();
	return onSubmit.mock.calls[0] as [KeyboardInput, File[] | undefined];
}

async function openSection(section: string) {
	await page.getByText(new RegExp(`^${section} —`)).click();
}

const dirty = () => page.getByTestId('dirty');

describe('KeyboardForm.svelte', () => {
	beforeEach(() => {
		vi.mocked(lookupsApi.getLookup).mockReset();
		vi.mocked(lookupsApi.getLookup).mockImplementation(
			async ({ category }) => ({ category, values: lookups[category] }) as never
		);
	});

	it('requires a brand and name', async () => {
		const { onSubmit } = renderForm();

		await page.getByLabelText('Brand').fill('   ');
		await submit();

		await expect.element(page.getByText('Brand and name are required.')).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('submits a minimal keyboard trimmed, private, and without empty sections', async () => {
		const { onSubmit } = renderForm();

		await page.getByLabelText('Brand').fill('  Bowl ');
		await page.getByLabelText('Name').fill(' Manta  ');
		await submit();

		expect(submitted(onSubmit)).toEqual([
			{
				brand: 'Bowl',
				name: 'Manta',
				size: undefined,
				layout: undefined,
				design: undefined,
				pcb: undefined,
				purchase: undefined,
				notes: undefined,
				visibility: Visibility.Private
			},
			undefined
		]);
	});

	it('nests every section that has a value into the submitted keyboard', async () => {
		const { onSubmit } = renderForm();

		await page.getByLabelText('Brand').fill('Bowl');
		await page.getByLabelText('Name').fill('Manta');
		await page.getByRole('radio', { name: 'Public' }).click();
		await page.getByLabelText('Size').selectOptions('65%');
		await page.getByLabelText('Layout').selectOptions('Alice');

		await openSection('Design');
		await page.getByLabelText('Top case material').selectOptions('Aluminum');
		await page.getByLabelText('Bottom case color').fill(' Navy ');
		await page.getByRole('checkbox', { name: 'POM' }).click();
		await page.getByRole('checkbox', { name: 'FR4' }).click();

		await openSection('PCB');
		await page.getByLabelText('Thickness (mm)').fill('1.6');
		await page.getByLabelText('Connectivity').selectOptions('Wireless');

		await openSection('Purchase');
		await page.getByLabelText('Vendor').selectOptions('NovelKeys');
		await page.getByLabelText('Price').fill('399.5');

		await page.getByLabelText('Notes').fill(' First Alice ');
		await submit();

		const [input] = submitted(onSubmit);
		expect(input).toEqual({
			brand: 'Bowl',
			name: 'Manta',
			size: '65%',
			layout: 'Alice',
			design: {
				topCase: { material: 'Aluminum', color: undefined },
				bottomCase: { material: undefined, color: 'Navy' },
				weight: undefined,
				plates: ['POM', 'FR4']
			},
			pcb: { thickness: 1.6, firmware: undefined, assembly: undefined, connectivity: 'Wireless' },
			purchase: {
				vendor: 'NovelKeys',
				price: 399.5,
				orderDate: undefined,
				deliveryDate: undefined,
				orderStatus: undefined
			},
			notes: 'First Alice',
			visibility: Visibility.Public
		});
	});

	it('round-trips an existing keyboard untouched, including values the lookups no longer offer', async () => {
		const { onSubmit } = renderForm({ initial: keyboard });

		await expect.element(page.getByRole('heading', { name: 'Edit keyboard' })).toBeInTheDocument();
		await expect.element(page.getByLabelText('Vendor')).toHaveValue('Group buy direct');
		await expect.element(page.getByRole('checkbox', { name: 'Carbon fiber' })).toBeChecked();
		await submit('Save changes');

		const [input] = submitted(onSubmit);
		expect(input).toEqual({
			brand: 'Bowl',
			name: 'Manta',
			size: '65%',
			layout: 'Alice',
			design: {
				topCase: { material: 'Aluminum', color: 'E-white' },
				bottomCase: { material: 'Polycarbonate', color: undefined },
				weight: { material: 'Brass', color: 'Mirror' },
				plates: ['POM', 'Carbon fiber']
			},
			pcb: { thickness: 1.2, firmware: 'QMK', assembly: 'Hotswap', connectivity: 'Wired' },
			purchase: {
				vendor: 'Group buy direct',
				price: 450,
				orderDate: new Date('2026-01-15'),
				deliveryDate: new Date('2026-08-02'),
				orderStatus: 'Delivered'
			},
			notes: 'Endgame, allegedly.',
			visibility: Visibility.Public
		});
	});

	it('summarizes each section and opens the ones an existing keyboard fills', async () => {
		renderForm({ initial: keyboard });

		await expect
			.element(page.getByText('— top case · bottom case · weight · 2 plates'))
			.toBeVisible();
		await expect.element(page.getByText('— QMK · Wired')).toBeVisible();
		await expect.element(page.getByText('— Group buy direct · Delivered')).toBeVisible();
		await expect.element(page.getByLabelText('Thickness (mm)')).toBeVisible();
	});

	it('starts with every section collapsed and unset for a new keyboard', async () => {
		renderForm();

		await expect.element(page.getByText('— Not set').nth(2)).toBeInTheDocument();
		await expect.element(page.getByLabelText('Thickness (mm)')).not.toBeVisible();
	});

	it('offers only the layouts that fit the chosen size', async () => {
		renderForm();

		await page.getByLabelText('Size').selectOptions('60%');

		const layout = page.getByLabelText('Layout');
		await expect.element(layout.getByRole('option', { name: 'HHKB' })).toBeInTheDocument();
		await expect.element(layout.getByRole('option', { name: 'Alice' })).not.toBeInTheDocument();
	});

	it('clears the layout when the size changes to one it does not fit', async () => {
		renderForm();

		await page.getByLabelText('Size').selectOptions('65%');
		await page.getByLabelText('Layout').selectOptions('Alice');
		await page.getByLabelText('Size').selectOptions('60%');

		await expect.element(page.getByLabelText('Layout')).toHaveValue('');
	});

	it('keeps the layout when the size changes to one it still fits', async () => {
		renderForm();

		await page.getByLabelText('Size').selectOptions('65%');
		await page.getByLabelText('Layout').selectOptions('ANSI');
		await page.getByLabelText('Size').selectOptions('TKL');

		await expect.element(page.getByLabelText('Layout')).toHaveValue('ANSI');
	});

	describe('order dates', () => {
		it('asks for an order date, defaulting to today, once ordered', async () => {
			renderForm();
			await openSection('Purchase');

			await page.getByLabelText('Order status').selectOptions('Planned');
			await expect.element(page.getByLabelText('Order date')).not.toBeInTheDocument();

			await page.getByLabelText('Order status').selectOptions('Ordered');
			await expect.element(page.getByLabelText('Order date')).toHaveValue(todayDateInput());
			await expect.element(page.getByLabelText('Delivery date')).not.toBeInTheDocument();
		});

		it('asks for a delivery date, defaulting to today, once delivered', async () => {
			renderForm();
			await openSection('Purchase');

			await page.getByLabelText('Order status').selectOptions('Delivered');

			await expect.element(page.getByLabelText('Order date')).toHaveValue(todayDateInput());
			await expect.element(page.getByLabelText('Delivery date')).toHaveValue(todayDateInput());
		});

		it('keeps a date the user already picked when the status moves on', async () => {
			renderForm();
			await openSection('Purchase');

			await page.getByLabelText('Order status').selectOptions('Ordered');
			await page.getByLabelText('Order date').fill('2026-03-04');
			await page.getByLabelText('Order status').selectOptions('Delivered');

			await expect.element(page.getByLabelText('Order date')).toHaveValue('2026-03-04');
		});

		it('drops dates the new status would not have', async () => {
			const { onSubmit } = renderForm({ initial: keyboard });

			await page.getByLabelText('Order status').selectOptions('Planned');
			await submit('Save changes');

			const [input] = submitted(onSubmit);
			expect(input.purchase?.orderDate).toBeUndefined();
			expect(input.purchase?.deliveryDate).toBeUndefined();
		});

		it('leaves existing dates alone on open, even if the status would not set them', async () => {
			const { onSubmit } = renderForm({
				initial: { ...keyboard, purchase: { ...keyboard.purchase, orderStatus: 'Planned' } }
			});

			await submit('Save changes');

			const [input] = submitted(onSubmit);
			expect(input.purchase?.orderDate).toEqual(new Date('2026-01-15'));
			expect(input.purchase?.deliveryDate).toEqual(new Date('2026-08-02'));
		});
	});

	describe('dirty', () => {
		it('starts clean for an existing keyboard', async () => {
			renderForm({ initial: keyboard });

			await expect.element(dirty()).toHaveTextContent('false');
		});

		it('turns dirty on an edit and clean again when it is undone', async () => {
			renderForm({ initial: keyboard });

			await page.getByLabelText('Name').fill('Manta 2');
			await expect.element(dirty()).toHaveTextContent('true');

			await page.getByLabelText('Name').fill('Manta');
			await expect.element(dirty()).toHaveTextContent('false');
		});

		it('ignores the order of plates', async () => {
			renderForm({ initial: keyboard });

			await page.getByRole('checkbox', { name: 'POM' }).click();
			await expect.element(dirty()).toHaveTextContent('true');
			await page.getByRole('checkbox', { name: 'POM' }).click();

			await expect.element(dirty()).toHaveTextContent('false');
		});

		it('turns dirty when a photo is staged', async () => {
			renderForm();

			await userEvent.upload(fileInput(), [png('a.png')]);

			await expect.element(dirty()).toHaveTextContent('true');
		});
	});

	describe('images on a new keyboard', () => {
		it('stages picked photos and submits them with the keyboard', async () => {
			const { onSubmit } = renderForm();
			const a = png('a.png');
			const b = png('b.png');

			await userEvent.upload(fileInput(), [a, b]);
			await expect.element(page.getByAltText('Selected keyboard').nth(1)).toBeInTheDocument();

			await page.getByLabelText('Brand').fill('Bowl');
			await page.getByLabelText('Name').fill('Manta');
			await submit();

			expect(submitted(onSubmit)[1]?.map((f) => f.name)).toEqual(['a.png', 'b.png']);
		});

		it('drops a staged photo when it is removed', async () => {
			const { onSubmit } = renderForm();
			const a = png('a.png');
			const b = png('b.png');

			await userEvent.upload(fileInput(), [a, b]);
			await page.getByRole('button', { name: 'Remove image 2 of 2' }).click();
			await page.getByLabelText('Brand').fill('Bowl');
			await page.getByLabelText('Name').fill('Manta');
			await submit();

			expect(submitted(onSubmit)[1]?.map((f) => f.name)).toEqual(['a.png']);
		});
	});

	describe('images on an existing keyboard', () => {
		it('uploads a picked photo straight away', async () => {
			const onImageUpload = vi.fn(async () => {});
			renderForm({ initial: keyboard, onImageUpload });
			const a = png('a.png');

			await userEvent.upload(fileInput(), [a]);

			await vi.waitFor(() => expect(onImageUpload).toHaveBeenCalledWith(a));
		});

		it('says so when an upload fails', async () => {
			renderForm({ initial: keyboard, onImageUpload: vi.fn().mockRejectedValue(new Error('x')) });

			await userEvent.upload(fileInput(), [png('a.png')]);

			await expect.element(page.getByText('Could not upload that image.')).toBeInTheDocument();
		});

		it('removes a photo by its id', async () => {
			const onImageRemove = vi.fn(async () => {});
			renderForm({ initial: keyboard, onImageRemove });

			await page.getByRole('button', { name: 'Remove image 1 of 1' }).click();

			expect(onImageRemove).toHaveBeenCalledWith('img-1');
		});
	});

	describe('cleared number fields', () => {
		it.each(['Thickness (mm)', 'Price'])(
			'%s leaves the form clean once typed into and cleared',
			async (label) => {
				renderForm();
				await openSection(label === 'Price' ? 'Purchase' : 'PCB');

				await page.getByLabelText(label).fill('5');
				await expect.element(dirty()).toHaveTextContent('true');
				await page.getByLabelText(label).fill('');

				await expect.element(dirty()).toHaveTextContent('false');
			}
		);

		it('drops a cleared price rather than keeping the old value', async () => {
			const { onSubmit } = renderForm({ initial: keyboard });

			await page.getByLabelText('Price').fill('');
			await submit('Save changes');

			expect(submitted(onSubmit)[0].purchase?.price).toBeNullable();
		});

		it('drops a cleared thickness rather than keeping the old value', async () => {
			const { onSubmit } = renderForm({ initial: keyboard });

			await page.getByLabelText('Thickness (mm)').fill('');
			await submit('Save changes');

			expect(submitted(onSubmit)[0].pcb?.thickness).toBeNullable();
		});
	});

	it("doesn't submit on Enter in a text field", async () => {
		const { onSubmit } = renderForm({ initial: keyboard });

		await page.getByLabelText('Name').click();
		await userEvent.keyboard('{Enter}');

		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('locks the buttons while saving and shows a save error', async () => {
		renderForm({ initial: keyboard, saving: true, error: 'kbdb said no' });

		await expect.element(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
		await expect.element(page.getByRole('button', { name: 'Cancel' })).toBeDisabled();
		await expect.element(page.getByText('kbdb said no')).toBeInTheDocument();
	});

	it('cancels', async () => {
		const { onCancel } = renderForm();

		await page.getByRole('button', { name: 'Cancel' }).click();

		expect(onCancel).toHaveBeenCalledOnce();
	});
});

function fileInput() {
	return page.elementLocator(document.querySelector('input[type="file"]')!);
}

function png(name: string) {
	return new File(['png'], name, { type: 'image/png' });
}
