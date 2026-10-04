import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadToSignedUrl } from './upload';

const file = new File(['png'], 'a.png', { type: 'image/png' });

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('uploadToSignedUrl', () => {
	it('PUTs the file with its content type to the signed URL', async () => {
		const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);

		await uploadToSignedUrl('https://bucket.example/signed', file);

		expect(fetchMock).toHaveBeenCalledWith('https://bucket.example/signed', {
			method: 'PUT',
			headers: { 'Content-Type': 'image/png' },
			body: file
		});
	});

	it('throws when the storage service rejects the upload', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(null, { status: 403 }))
		);

		await expect(uploadToSignedUrl('https://bucket.example/signed', file)).rejects.toThrow(
			'upload failed: 403'
		);
	});
});
