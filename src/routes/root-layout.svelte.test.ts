import { page, userEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/discover') } }));
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$lib/auth/auth.svelte', () => ({
	initAuth: vi.fn(async () => {}),
	signIn: vi.fn(),
	signOut: vi.fn(),
	auth: { status: 'signed-out', user: null }
}));
vi.mock('$lib/profile/profile.svelte', () => ({
	initProfile: vi.fn(),
	profile: { status: 'idle', data: null }
}));
vi.mock('$lib/api/client', () => ({ profilesApi: { listProfiles: vi.fn() } }));

const content = createRawSnippet(() => ({ render: () => '<p>Page content</p>' }));

function renderLayout() {
	render(Layout, { children: content });
}

describe('root layout', () => {
	it('puts the page content inside the main landmark', async () => {
		renderLayout();

		await expect.element(page.getByRole('main')).toHaveTextContent('Page content');
	});

	it('offers a skip link as the first stop, and it moves focus to the content', async () => {
		renderLayout();
		const skip = page.getByRole('link', { name: 'Skip to content' });

		await userEvent.keyboard('{Tab}');
		await expect.element(skip).toHaveFocus();
		await userEvent.keyboard('{Enter}');

		await expect.element(page.getByRole('main')).toHaveFocus();
	});

	it('names the site navigation and marks the current page', async () => {
		await page.viewport(1024, 768);
		try {
			renderLayout();

			await expect
				.element(
					page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Discover' })
				)
				.toHaveAttribute('aria-current', 'page');
		} finally {
			await page.viewport(414, 896);
		}
	});
});
