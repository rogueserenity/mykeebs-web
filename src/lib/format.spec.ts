import { describe, expect, it, vi, afterEach } from 'vitest';
import { formatPrice, toDateInput, todayDateInput } from './format';

describe('formatPrice', () => {
	it('formats a price in its currency', () => {
		expect(formatPrice(31.5, 'USD')).toBe('$31.50');
		expect(formatPrice(31.5, 'EUR')).toBe('€31.50');
	});

	it('shows nothing without a price', () => {
		expect(formatPrice(undefined, 'USD')).toBeUndefined();
	});

	it('shows nothing rather than guess a currency', () => {
		expect(formatPrice(31.5, undefined)).toBeUndefined();
	});

	it('still formats a zero price', () => {
		expect(formatPrice(0, 'USD')).toBe('$0.00');
	});
});

describe('toDateInput', () => {
	it('is empty for an unset date', () => {
		expect(toDateInput(undefined)).toBe('');
	});

	it('reads an API calendar date back as the same day', () => {
		// The API hands these back as UTC midnight.
		expect(toDateInput(new Date('2026-03-20T00:00:00Z'))).toBe('2026-03-20');
	});
});

describe('todayDateInput', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('formats today in local time', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-20T12:00:00Z'));
		expect(todayDateInput()).toBe('2026-09-20');
	});

	it('does not roll back a day west of UTC', () => {
		// 19:00 in New York is already the 21st in UTC, but the field should
		// still read the 20th.
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-09-21T02:00:00Z'));
		const local = new Date();
		const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
		expect(todayDateInput()).toBe(expected);
	});
});
