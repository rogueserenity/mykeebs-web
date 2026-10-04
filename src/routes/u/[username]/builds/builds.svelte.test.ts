import { page, userEvent } from 'vitest/browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Visibility, type Build } from '@rogueserenity/kbdb-api-client';
import { buildsApi, keyboardsApi } from '$lib/api/client';
import WithUserContext from '$lib/components/test-support/WithUserContext.svelte';
import BuildsPage from './+page.svelte';

vi.mock('$lib/image-resize', () => ({
	prepareImage: async (file: File) => {
		// The first photo finishes converting last, so out-of-order uploads would show.
		if (file.name === 'a.jpg') await new Promise((resolve) => setTimeout(resolve, 50));
		return new File([file], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' });
	}
}));
vi.mock('$lib/api/client', () => ({
	buildsApi: {
		listBuilds: vi.fn(),
		getBuild: vi.fn(),
		createBuild: vi.fn(),
		createBuildImage: vi.fn()
	},
	keyboardsApi: { listKeyboards: vi.fn(), getKeyboard: vi.fn() },
	switchesApi: { listSwitches: vi.fn() },
	keycapSetsApi: { listKeycapSets: vi.fn() },
	lookupsApi: { getLookup: vi.fn(async () => ({ values: [] })) }
}));

const builds = vi.mocked(buildsApi);
const manta = { id: 'kb-1', brand: 'Bowl', name: 'Manta' };

const mantaBuild: Build = {
	id: 'b-1',
	visibility: Visibility.Public,
	keyboard: manta,
	buildDate: new Date('2026-09-10T12:00:00Z')
};

function renderPage() {
	render(WithUserContext, { component: BuildsPage, isOwnProfile: true });
}

const dialog = () => page.getByRole('dialog').last();
const jpg = (name: string) => new File([name], name, { type: 'image/jpeg' });

async function startBuildWithPhotos(...files: File[]) {
	await page.getByRole('button', { name: 'Add build' }).click();
	await dialog().getByRole('button', { name: 'Choose keyboard…' }).click();
	await dialog().getByRole('option', { name: /Manta/ }).click();
	await userEvent.upload(page.elementLocator(document.querySelector('input[type="file"]')!), files);
	await dialog().getByRole('button', { name: 'Add build' }).click();
}

beforeEach(() => {
	vi.clearAllMocks();
	builds.listBuilds.mockResolvedValue({ items: [mantaBuild] });
	builds.createBuild.mockResolvedValue({ ...mantaBuild, id: 'b-2' });
	vi.mocked(keyboardsApi.listKeyboards).mockResolvedValue({ items: [manta] } as never);
	vi.mocked(keyboardsApi.getKeyboard).mockResolvedValue(manta);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('builds page', () => {
	it('lists builds grouped by keyboard', async () => {
		renderPage();

		await expect.element(page.getByRole('link', { name: /Manta/ })).toBeInTheDocument();
	});

	it('creates a build and uploads its staged photos as WebP, in order', async () => {
		const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		builds.createBuildImage
			.mockResolvedValueOnce({ uploadUrl: 'https://bucket.example/a' } as never)
			.mockResolvedValueOnce({ uploadUrl: 'https://bucket.example/b' } as never);
		renderPage();

		await startBuildWithPhotos(jpg('a.jpg'), jpg('b.jpg'));

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
		expect(builds.createBuild).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				buildInput: expect.objectContaining({ keyboard: 'kb-1' })
			})
		);
		expect(builds.createBuildImage).toHaveBeenCalledWith({
			userId: 'user-1',
			buildId: 'b-2',
			imageUploadRequest: { contentType: 'image/webp', sizeBytes: expect.any(Number) }
		});
		expect(fetchMock.mock.calls.map(([url, init]) => [url, (init?.body as File).name])).toEqual([
			['https://bucket.example/a', 'a.webp'],
			['https://bucket.example/b', 'b.webp']
		]);
	});

	it('still closes when a photo upload fails, since the build exists', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 403 }))
		);
		builds.createBuildImage.mockResolvedValue({ uploadUrl: 'https://bucket.example/a' } as never);
		renderPage();

		await startBuildWithPhotos(jpg('a.jpg'));

		await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
	});
});
