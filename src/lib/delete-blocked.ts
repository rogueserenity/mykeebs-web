import { ProblemFromJSON, ResponseError, type Build } from '@rogueserenity/kbdb-api-client';
import { formatDate } from '$lib/format';

export async function blockingBuildIdsFromError(err: unknown): Promise<string[] | null> {
	if (!(err instanceof ResponseError) || err.response.status !== 409) return null;
	const body: unknown = await err.response
		.clone()
		.json()
		.catch(() => null);
	if (!body || typeof body !== 'object') return [];
	return ProblemFromJSON(body).blockingBuildIds ?? [];
}

export function blockingBuildLabel(build: Build): string {
	const date = formatDate(build.buildDate);
	return date ? `${build.keyboard.name} (${date})` : build.keyboard.name;
}

export function blockingBuildLabels(
	buildIds: string[],
	getBuild: (buildId: string) => Promise<Build>
): Promise<string[]> {
	return Promise.all(
		buildIds.map((buildId) => getBuild(buildId).then(blockingBuildLabel, () => 'a build'))
	);
}
