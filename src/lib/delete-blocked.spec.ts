import { describe, expect, it } from 'vitest';
import { ResponseError } from '@rogueserenity/kbdb-api-client';
import { blockingBuildIdsFromError } from './delete-blocked';

function problem(status: number, body: unknown): ResponseError {
	return new ResponseError(
		new Response(JSON.stringify(body), {
			status,
			headers: { 'Content-Type': 'application/problem+json' }
		})
	);
}

describe('blockingBuildIdsFromError', () => {
	it("reads the blocking builds from kbdb's 409 problem response", async () => {
		const err = problem(409, {
			type: 'about:blank',
			title: 'Conflict',
			status: 409,
			blocking_build_ids: ['b-1', 'b-2']
		});

		expect(await blockingBuildIdsFromError(err)).toEqual(['b-1', 'b-2']);
	});

	it('is empty for a 409 that names no builds', async () => {
		expect(
			await blockingBuildIdsFromError(problem(409, { type: 'about:blank', status: 409 }))
		).toEqual([]);
		expect(
			await blockingBuildIdsFromError(new ResponseError(new Response('oops', { status: 409 })))
		).toEqual([]);
	});

	it('is null for any other failure', async () => {
		expect(await blockingBuildIdsFromError(problem(404, { status: 404 }))).toBeNull();
		expect(await blockingBuildIdsFromError(new Error('network'))).toBeNull();
	});
});
