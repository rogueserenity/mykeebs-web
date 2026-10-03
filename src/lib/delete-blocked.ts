import { ProblemFromJSON, ResponseError } from '@rogueserenity/kbdb-api-client';

export async function blockingBuildIdsFromError(err: unknown): Promise<string[] | null> {
	if (!(err instanceof ResponseError) || err.response.status !== 409) return null;
	const body: unknown = await err.response
		.clone()
		.json()
		.catch(() => null);
	if (!body || typeof body !== 'object') return [];
	return ProblemFromJSON(body).blockingBuildIds ?? [];
}
