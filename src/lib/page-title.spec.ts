import { describe, expect, it } from 'vitest';
import { pageTitle } from './page-title';

describe('pageTitle', () => {
	it('is just the site name with no parts', () => {
		expect(pageTitle()).toBe('mykeebs');
	});

	it('puts the most specific part first and the site name last', () => {
		expect(pageTitle('Keyboards', '@rogue.serenity')).toBe('Keyboards · @rogue.serenity · mykeebs');
	});

	it('skips empty parts', () => {
		expect(pageTitle('', 'Discover', ' ')).toBe('Discover · mykeebs');
	});
});
