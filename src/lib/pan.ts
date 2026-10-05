export function clampOffset(
	offset: number,
	imageSize: number,
	scale: number,
	viewportSize: number
): number {
	const limit = Math.max(0, (imageSize * scale - viewportSize) / 2);
	if (limit === 0) return 0;
	return Math.min(limit, Math.max(-limit, offset));
}
