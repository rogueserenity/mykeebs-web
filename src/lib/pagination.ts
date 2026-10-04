type Page<T> = { items?: T[]; nextCursor?: string | null };

export async function fetchAllPages<T>(
	fetchPage: (cursor: string | undefined) => Promise<Page<T>>
): Promise<T[]> {
	const items: T[] = [];
	let cursor: string | undefined;
	do {
		const page = await fetchPage(cursor);
		items.push(...(page.items ?? []));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return items;
}
