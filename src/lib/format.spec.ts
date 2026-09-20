import { describe, expect, it, vi, afterEach } from 'vitest';
import { toDateInput, todayDateInput } from './format';

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
