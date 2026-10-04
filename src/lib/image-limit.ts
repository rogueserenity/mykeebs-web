export const MAX_IMAGES = 10;

export function takeWithinLimit<T>(
	picked: T[],
	current: number,
	max = MAX_IMAGES
): { accepted: T[]; skipped: number } {
	const room = Math.max(0, max - current);
	return { accepted: picked.slice(0, room), skipped: Math.max(0, picked.length - room) };
}

export function limitNotice(skipped: number, max = MAX_IMAGES): string {
	return `Up to ${max} photos are allowed, so ${skipped} ${skipped === 1 ? 'was' : 'were'} not added.`;
}
