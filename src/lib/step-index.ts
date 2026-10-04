export function stepIndex(index: number, delta: 1 | -1, length: number): number {
	return (index + delta + length) % length;
}
