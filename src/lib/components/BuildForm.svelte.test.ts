import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Visibility, type Build } from '@rogueserenity/kbdb-api-client';
import { kitKey, type StaleBuildRefs } from '$lib/build-refs';
import BuildFormWithUser from './test-support/BuildFormWithUser.svelte';
import '../../routes/layout.css';

vi.mock('$lib/api/client', () => ({
	lookupsApi: { getLookup: vi.fn(async () => ({ values: [] })) },
	keyboardsApi: { getKeyboard: vi.fn(async () => ({ id: 'kb', brand: '', name: '' })) },
	switchesApi: {},
	keycapSetsApi: {}
}));

const build: Build = {
	id: 'b',
	visibility: Visibility.Private,
	keyboard: { id: 'kb', brand: 'Bowl', name: 'Manta' },
	switches: [
		{ _switch: { id: 'sw-a', brand: 'HMX', name: 'Aperol', type: 'Linear' }, count: 70 },
		{ _switch: { id: 'sw-b', brand: 'Gateron', name: 'Oil King', type: 'Linear' }, count: 4 }
	],
	keycapSets: [
		{
			id: 'set-1',
			brand: 'GMK',
			name: '8008 2',
			kits: [
				{ kitId: 'base', name: 'Base' },
				{ kitId: 'aesthetic', name: 'Aesthetic' }
			]
		}
	]
};

function renderForm(staleRefs: StaleBuildRefs | null) {
	render(BuildFormWithUser, {
		formProps: {
			initial: build,
			saving: false,
			error: null,
			staleRefs,
			onSubmit: vi.fn(),
			onCancel: vi.fn()
		}
	});
}

const NOTE = 'No longer in your collection';

describe('BuildForm.svelte stale references', () => {
	it('flags only the switches and kits kbdb rejected', async () => {
		renderForm({
			keyboardId: null,
			switchIds: new Set(['sw-b']),
			kitKeys: new Set([kitKey('set-1', 'aesthetic')])
		});

		const items = page.getByRole('listitem');
		await expect.element(items.filter({ hasText: 'Oil King' })).toHaveTextContent(NOTE);
		await expect.element(items.filter({ hasText: '8008 2 — Aesthetic' })).toHaveTextContent(NOTE);
		await expect.element(items.filter({ hasText: 'Aperol' })).not.toHaveTextContent(NOTE);
		await expect.element(items.filter({ hasText: '8008 2 — Base' })).not.toHaveTextContent(NOTE);
	});

	it('flags the keyboard when it is the one kbdb rejected', async () => {
		renderForm({ keyboardId: 'kb', switchIds: new Set(), kitKeys: new Set() });

		await expect.element(page.getByText(NOTE)).toBeInTheDocument();
	});

	it("doesn't flag a keyboard other than the rejected one", async () => {
		renderForm({ keyboardId: 'replaced', switchIds: new Set(), kitKeys: new Set() });

		await expect.element(page.getByText('Manta')).toBeInTheDocument();
		await expect.element(page.getByText(NOTE)).not.toBeInTheDocument();
	});

	it('flags nothing without a stale-reference error', async () => {
		renderForm(null);

		await expect.element(page.getByText('Manta')).toBeInTheDocument();
		await expect.element(page.getByText(NOTE)).not.toBeInTheDocument();
	});
});

describe('BuildForm.svelte cleared stabilizer price', () => {
	function renderWithStabs(stabs: Build['stabs']) {
		const onSubmit = vi.fn();
		render(BuildFormWithUser, {
			formProps: {
				initial: { ...build, stabs },
				saving: false,
				error: null,
				staleRefs: null,
				onSubmit,
				onCancel: vi.fn()
			}
		});
		return onSubmit;
	}

	it('leaves the form clean once the price is typed into and cleared', async () => {
		renderWithStabs({ name: 'Durock V2' });
		const dirty = page.getByTestId('dirty');
		const price = page.getByLabelText('Price');

		await price.fill('15');
		await expect.element(dirty).toHaveTextContent('true');
		await price.fill('');

		await expect.element(dirty).toHaveTextContent('false');
	});

	it('drops a cleared price rather than keeping the old value', async () => {
		const onSubmit = renderWithStabs({ name: 'Durock V2', price: 15 });

		await page.getByLabelText('Price').fill('');
		await page.getByRole('button', { name: 'Save changes' }).click();

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		expect(onSubmit.mock.calls[0][0].stabs?.price).toBeNullable();
	});
});

describe('BuildForm.svelte switch counts', () => {
	function renderBuild() {
		const onSubmit = vi.fn();
		render(BuildFormWithUser, {
			formProps: {
				initial: build,
				saving: false,
				error: null,
				staleRefs: null,
				onSubmit,
				onCancel: vi.fn()
			}
		});
		return onSubmit;
	}

	const countFor = (label: string) => page.getByRole('spinbutton', { name: `Count of ${label}` });

	it('refuses to save a switch whose count was cleared', async () => {
		const onSubmit = renderBuild();

		await countFor('Oil King (Gateron)').fill('');
		await page.getByRole('button', { name: 'Save changes' }).click();

		await expect
			.element(page.getByText('Every switch needs a count of at least 1.'))
			.toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it('saves once every switch has a count again', async () => {
		const onSubmit = renderBuild();

		await countFor('Oil King (Gateron)').fill('');
		await page.getByRole('button', { name: 'Save changes' }).click();
		await countFor('Oil King (Gateron)').fill('6');
		await page.getByRole('button', { name: 'Save changes' }).click();

		await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		expect(onSubmit.mock.calls[0][0].switches).toEqual([
			{ _switch: 'sw-a', count: 70 },
			{ _switch: 'sw-b', count: 6 }
		]);
		await expect
			.element(page.getByText('Every switch needs a count of at least 1.'))
			.not.toBeInTheDocument();
	});
});

describe('BuildForm.svelte switch rows', () => {
	it('names each count field after its switch and keeps the switch name visible', async () => {
		renderForm(null);

		for (const label of ['Aperol (HMX)', 'Oil King (Gateron)']) {
			await expect
				.element(page.getByRole('spinbutton', { name: `Count of ${label}` }))
				.toBeInTheDocument();
			await expect.element(page.getByText(label)).toBeVisible();
		}
	});
});

describe('BuildForm.svelte remove buttons', () => {
	it('names each remove button after its row and removes only that row', async () => {
		renderForm(null);

		await page.getByRole('button', { name: 'Remove Oil King (Gateron)' }).click();
		await page.getByRole('button', { name: 'Remove 8008 2 — Aesthetic' }).click();

		await expect.element(page.getByText('Oil King (Gateron)')).not.toBeInTheDocument();
		await expect.element(page.getByText('8008 2 — Aesthetic')).not.toBeInTheDocument();
		await expect.element(page.getByText('Aperol (HMX)')).toBeInTheDocument();
		await expect.element(page.getByText('8008 2 — Base')).toBeInTheDocument();
	});
});

describe('BuildForm.svelte image remove buttons', () => {
	it('numbers each image remove button and removes the right image', async () => {
		const onImageRemove = vi.fn(async () => {});
		render(BuildFormWithUser, {
			formProps: {
				initial: {
					...build,
					images: [
						{ imageId: 'img-1', url: 'https://img.example/1.png' },
						{ imageId: 'img-2', url: 'https://img.example/2.png' }
					]
				},
				saving: false,
				error: null,
				staleRefs: null,
				onSubmit: vi.fn(),
				onCancel: vi.fn(),
				onImageRemove
			}
		});

		await expect
			.element(page.getByRole('button', { name: 'Remove image 1 of 2' }))
			.toBeInTheDocument();
		await page.getByRole('button', { name: 'Remove image 2 of 2' }).click();

		expect(onImageRemove).toHaveBeenCalledWith('img-2');
	});
});
