import type { Build } from '@rogueserenity/kbdb-api-client';

export function primaryBuildImageUrl(build: Build): string | undefined {
	return build.images?.[0]?.url;
}
