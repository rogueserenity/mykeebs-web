import type { Keyboard, KeycapSet, Switch } from '@rogueserenity/kbdb-api-client';

// List rows' presigned image URLs can expire while a page sits open, so a
// details view built from a row refetches the item once when an image fails.
// Only the image URLs are taken from the refetch: the shown item may have been
// edited since the request went out, and a late response mustn't undo that.
export function staleImageRefetcher<T>(
	fetchItem: (id: string) => Promise<T>,
	onFresh: (item: T, id: string) => void
) {
	let refetchedId: string | null = null;

	return {
		reset() {
			refetchedId = null;
		},
		async refetch(id: string) {
			if (refetchedId === id) return;
			refetchedId = id;
			let item: T;
			try {
				item = await fetchItem(id);
			} catch {
				return;
			}
			onFresh(item, id);
		}
	};
}

export function withFreshKeyboardImageUrls(current: Keyboard, fresh: Keyboard): Keyboard {
	const urls = new Map(fresh.images?.map((image) => [image.imageId, image.url]));
	return {
		...current,
		images: current.images?.map((image) => ({
			...image,
			url: urls.get(image.imageId) ?? image.url
		}))
	};
}

export function withFreshSwitchImageUrl(current: Switch, fresh: Switch): Switch {
	if (!current.image || !fresh.image) return current;
	return { ...current, image: { ...current.image, url: fresh.image.url } };
}

export function withFreshKitImageUrls(current: KeycapSet, fresh: KeycapSet): KeycapSet {
	const urls = new Map(fresh.kits?.map((kit) => [kit.kitId, kit.image?.url]));
	return {
		...current,
		kits: current.kits?.map((kit) => {
			const url = urls.get(kit.kitId);
			return kit.image && url ? { ...kit, image: { ...kit.image, url } } : kit;
		})
	};
}

export function updateWhere<T>(
	items: T[],
	matches: (item: T) => boolean,
	update: (item: T) => T
): T[] {
	return items.map((item) => (matches(item) ? update(item) : item));
}

export function anyImageFailed(
	urls: (string | undefined)[] | undefined,
	failedImages: ReadonlySet<string>
): boolean {
	return urls?.some((url) => url !== undefined && failedImages.has(url)) ?? false;
}
