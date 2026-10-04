import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url).pathname;

function svelteFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return svelteFiles(path);
		return entry.name.endsWith('.svelte') ? [path] : [];
	});
}

describe('error messages', () => {
	it('are announced: every danger-colored dynamic message has role="alert"', () => {
		const unannounced = svelteFiles(root).flatMap((file) =>
			[...readFileSync(file, 'utf8').matchAll(/<(p|span)\b[^>]*style="color: var\(--danger\)">\{/g)]
				.filter(([tag]) => !tag.includes('role="alert"'))
				.map(([tag]) => `${relative(root, file)}: ${tag}`)
		);

		expect(unannounced).toEqual([]);
	});
});
