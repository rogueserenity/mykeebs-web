import type { KeycapSet, Switch } from '@rogueserenity/kbdb-api-client';

// Callers copy only image URLs from the refetch, so a late response can't undo an edit.
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

type WithImages = { images?: { imageId: string; url: string }[] };

export function withFreshImageUrls<T extends WithImages>(current: T, fresh: T): T {
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

// Throttled per item so an image that's broken, not expired, can't refetch in a loop.
export function perItemImageRefetcher<T>(
	fetchItem: (id: string) => Promise<T>,
	onFresh: (item: T, id: string) => void,
	minIntervalMs = 60_000,
	now: () => number = Date.now
) {
	const lastFetched = new Map<string, number>();

	return async function refetch(id: string) {
		const last = lastFetched.get(id);
		if (last !== undefined && now() - last < minIntervalMs) return;
		lastFetched.set(id, now());
		let item: T;
		try {
			item = await fetchItem(id);
		} catch {
			return;
		}
		onFresh(item, id);
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
