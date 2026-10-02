import type { KeycapSet } from '@rogueserenity/kbdb-api-client';

export function primaryKitImageUrl(set: KeycapSet): string | undefined {
	return set.kits?.find((kit) => kit.kitId === set.primaryKitId)?.image?.url;
}
