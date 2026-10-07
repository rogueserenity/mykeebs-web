import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = new URL('../..', import.meta.url).pathname;
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return sourceFiles(path);
		return /\.(ts|svelte)$/.test(entry.name) && !/\.(spec|test)\.ts$/.test(entry.name)
			? [path]
			: [];
	});
}

function envKeys(source: string): string[] {
	return [...source.matchAll(/^(PUBLIC_\w+)=/gm)].map(([, key]) => key).sort();
}

describe('Node version', () => {
	it('matches between mise.toml and .node-version, which Cloudflare builds read', () => {
		const mise = read('mise.toml').match(/^node = "([^"]+)"$/m)?.[1];
		expect(mise).toMatch(/^\d+\.\d+\.\d+$/);
		expect(read('.node-version').trim()).toBe(mise);
	});
});

describe('public env vars', () => {
	const used = [
		...new Set(
			sourceFiles(join(root, 'src')).flatMap((file) =>
				[...readFileSync(file, 'utf8').matchAll(/\bPUBLIC_[A-Z_]+\b/g)].map(([name]) => name)
			)
		)
	].sort();

	it('are found', () => {
		expect(used.length).toBeGreaterThan(0);
	});

	it.each(['.env.production', '.env.example'])('are exactly the ones %s defines', (file) => {
		expect(envKeys(read(file))).toEqual(used);
	});

	it('are all set in CI, where the build runs without an env file', () => {
		const ci = read('.github/workflows/ci.yml');
		const ciKeys = [...ci.matchAll(/^ {2}(PUBLIC_\w+):/gm)].map(([, key]) => key).sort();
		expect(ciKeys).toEqual(used);
	});
});
