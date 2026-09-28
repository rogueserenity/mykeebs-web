import { describe, expect, it } from 'vitest';
import type { Switch } from '@rogueserenity/kbdb-api-client';
import { collectionStats, countsFor, totalsFor } from './collection-stats';

function sw(purchase: Switch['purchase']): Switch {
	return { id: 's', brand: 'HMX', name: 'Aperol', type: 'Linear', purchase };
}

const empty = { keyboards: [], switches: [], keycapSets: [], builds: [] };

describe('collectionStats', () => {
	it('reads a switch status and price from its purchase', () => {
		const stats = collectionStats({
			...empty,
			switches: [sw({ orderStatus: 'Delivered', price: 31.5, currency: 'USD' })]
		});
		expect(stats.switches).toEqual([{ status: 'Delivered', price: 31.5 }]);
	});

	it('takes the currency from whichever item carries a price', () => {
		const stats = collectionStats({
			...empty,
			keyboards: [{ id: 'k', orderStatus: 'Delivered' }],
			switches: [sw({ price: 20, currency: 'EUR' })]
		});
		expect(stats.currency).toBe('EUR');
	});

	it('has no currency when kbdb withheld every price', () => {
		const stats = collectionStats({
			...empty,
			keyboards: [{ id: 'k', orderStatus: 'Delivered' }],
			switches: [sw({ orderStatus: 'Delivered' })],
			builds: [{ id: 'b' }]
		});
		expect(stats.currency).toBeUndefined();
	});
});

describe('countsFor and totalsFor', () => {
	const stats = collectionStats({
		keyboards: [
			{ id: 'k1', orderStatus: 'Delivered', price: 100, currency: 'USD' },
			{ id: 'k2', orderStatus: 'Ordered', price: 50, currency: 'USD' }
		],
		switches: [
			sw({ orderStatus: 'Delivered', price: 30, currency: 'USD' }),
			sw({ orderStatus: 'Shipped', price: 20, currency: 'USD' })
		],
		keycapSets: [{ id: 'c', orderStatus: 'Delivered', totalCost: 120, currency: 'USD' }],
		builds: [{ id: 'b', totalCost: 400, currency: 'USD' }]
	});

	it('counts and sums everything under all', () => {
		expect(countsFor(stats, 'all')).toEqual({
			keyboards: 2,
			switches: 2,
			keycapSets: 1,
			builds: 1
		});
		expect(totalsFor(stats, 'all')).toEqual({
			keyboards: 150,
			switches: 50,
			keycapSets: 120,
			builds: 400
		});
	});

	it('narrows counts and totals to the filtered status, ignoring case', () => {
		expect(countsFor(stats, 'delivered')).toEqual({
			keyboards: 1,
			switches: 1,
			keycapSets: 1,
			builds: 0
		});
		expect(totalsFor(stats, 'delivered')).toEqual({
			keyboards: 100,
			switches: 30,
			keycapSets: 120,
			builds: 0
		});
	});
});
