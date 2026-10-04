import { describe, expect, it } from 'vitest';
import { Ban, ClipboardList, FunnelX, Package, ShoppingBag, Truck } from 'lucide-svelte';
import {
	STATUS_FILTERS,
	orderStatusIcon,
	statusFilterIcon,
	statusFilterLabel
} from './order-status';

describe('statusFilterIcon', () => {
	it('has an icon for every filter', () => {
		expect(STATUS_FILTERS.map(statusFilterIcon)).toEqual([
			FunnelX,
			ClipboardList,
			ShoppingBag,
			Truck,
			Package,
			Ban
		]);
	});
});

describe('orderStatusIcon', () => {
	it("matches an item's status regardless of case", () => {
		expect(orderStatusIcon('Delivered')).toBe(Package);
		expect(orderStatusIcon('SHIPPED')).toBe(Truck);
	});

	it('has no icon for "all", which is a filter rather than a status', () => {
		expect(orderStatusIcon('All')).toBeUndefined();
	});

	it('has no icon for a status it does not know', () => {
		expect(orderStatusIcon('Lost in transit')).toBeUndefined();
	});
});

describe('statusFilterLabel', () => {
	it('capitalizes the filter for titles, which CSS uppercasing never reaches', () => {
		expect(STATUS_FILTERS.map(statusFilterLabel)).toEqual([
			'All',
			'Planned',
			'Ordered',
			'Shipped',
			'Delivered',
			'Cancelled'
		]);
	});
});
