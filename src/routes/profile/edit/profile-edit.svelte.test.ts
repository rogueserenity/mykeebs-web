import { page } from 'vitest/browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Profile } from '@rogueserenity/kbdb-api-client';
import ProfileEditPage from './+page.svelte';

const existing = vi.hoisted((): Profile => ({
	userId: 'user-1',
	username: 'rogue.serenity',
	discoverable: true,
	links: [
		{ name: 'GitHub', url: 'https://github.com/rogueserenity' },
		{ name: 'Mastodon', url: 'https://example.social/@rogue' }
	]
}));

vi.mock('$lib/auth/auth.svelte', () => ({
	auth: { status: 'signed-in', user: { id: 'user-1', email: null } }
}));
const profileState = vi.hoisted(() => ({ status: 'ready', data: undefined as unknown }));

vi.mock('$lib/profile/profile.svelte', () => ({
	profile: profileState,
	saveProfile: vi.fn(),
	refreshProfile: vi.fn()
}));
vi.mock('$lib/api/client', () => ({ profilesApi: {} }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

beforeEach(() => {
	profileState.status = 'ready';
	profileState.data = existing;
});

describe('Profile edit page links', () => {
	it('names each remove button after its link and removes only that link', async () => {
		render(ProfileEditPage);

		await page.getByRole('button', { name: 'Remove GitHub link' }).click();

		await expect
			.element(page.getByRole('button', { name: 'Remove GitHub link' }))
			.not.toBeInTheDocument();
		await expect
			.element(page.getByRole('button', { name: 'Remove Mastodon link' }))
			.toBeInTheDocument();
	});

	it('falls back to the position for a link without a label yet', async () => {
		render(ProfileEditPage);

		await page.getByRole('button', { name: 'Add link' }).click();

		await expect.element(page.getByRole('button', { name: 'Remove link 3' })).toBeInTheDocument();
	});
});

describe('Profile edit page link fields', () => {
	it('labels each link field by its position', async () => {
		render(ProfileEditPage);

		await expect.element(page.getByRole('textbox', { name: 'Link 1 label' })).toHaveValue('GitHub');
		await expect
			.element(page.getByRole('textbox', { name: 'Link 1 URL' }))
			.toHaveValue('https://github.com/rogueserenity');
		await expect
			.element(page.getByRole('textbox', { name: 'Link 2 label' }))
			.toHaveValue('Mastodon');
		await expect
			.element(page.getByRole('textbox', { name: 'Link 2 URL' }))
			.toHaveValue('https://example.social/@rogue');
	});
});

describe('Profile edit page title', () => {
	it('titles the tab for editing an existing profile', async () => {
		render(ProfileEditPage);

		await vi.waitFor(() => expect(document.title).toBe('Edit profile · mykeebs'));
	});

	it('titles the tab for setting up a new profile', async () => {
		profileState.status = 'none';
		profileState.data = undefined;

		render(ProfileEditPage);

		await vi.waitFor(() => expect(document.title).toBe('Set up profile · mykeebs'));
	});
});
