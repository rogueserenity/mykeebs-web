import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Visibility, type Build } from '@rogueserenity/kbdb-api-client';
import { kitKey, type StaleBuildRefs } from '$lib/build-refs';
import BuildFormWithUser from './test-support/BuildFormWithUser.svelte';

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
