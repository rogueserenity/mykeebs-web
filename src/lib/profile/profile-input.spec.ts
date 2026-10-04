import { describe, expect, it } from 'vitest';
import { cleanLinks, usernameLooksValid } from './profile-input';

describe('usernameLooksValid', () => {
	it.each(['abc', 'rogue.serenity', 'jay_b', 'key-board-99', 'a'.repeat(32)])(
		'accepts %s',
		(name) => {
			expect(usernameLooksValid(name)).toBe(true);
		}
	);

	it.each([
		['too short', 'ab'],
		['too long', 'a'.repeat(33)],
		['uppercase', 'Rogue'],
		['a leading separator', '.rogue'],
		['a trailing separator', 'rogue_'],
		['consecutive separators', 'rogue..serenity'],
		['mixed consecutive separators', 'rogue-_serenity'],
		['a space', 'rogue serenity'],
		['the reserved user- prefix', 'user-123'],
		['nothing', '']
	])('rejects %s', (_, name) => {
		expect(usernameLooksValid(name)).toBe(false);
	});
});

describe('cleanLinks', () => {
	it('trims links and drops rows left completely empty', () => {
		expect(
			cleanLinks([
				{ name: ' GitHub ', url: ' https://github.com/rogue ' },
				{ name: ' ', url: '' }
			])
		).toEqual({ links: [{ name: 'GitHub', url: 'https://github.com/rogue' }] });
	});

	it('is empty when there are no links', () => {
		expect(cleanLinks([])).toEqual({ links: [] });
	});

	it('needs both a name and a URL', () => {
		expect(cleanLinks([{ name: 'GitHub', url: '' }])).toEqual({
			error: 'Each link needs both a name and a URL.'
		});
		expect(cleanLinks([{ name: '', url: 'https://github.com' }])).toEqual({
			error: 'Each link needs both a name and a URL.'
		});
	});

	it('only accepts https URLs, in any case', () => {
		expect(cleanLinks([{ name: 'Site', url: 'http://example.com' }])).toEqual({
			error: 'Link URLs must start with https://.'
		});
		expect(cleanLinks([{ name: 'Site', url: 'HTTPS://example.com' }])).toEqual({
			links: [{ name: 'Site', url: 'HTTPS://example.com' }]
		});
	});
});
