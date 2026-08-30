export type PurchaseLike = {
	vendor?: string;
	price?: number;
	quantity?: number;
	orderDate?: Date;
	deliveryDate?: Date;
	orderStatus?: string;
};

const orderStatusColors: Record<string, string> = {
	ordered: 'status-ordered',
	shipped: 'status-shipped',
	delivered: 'status-delivered',
	sold: 'status-sold'
};

export function orderStatusClass(status: string): string {
	return orderStatusColors[status.toLowerCase()] ?? 'status-default';
}

// The API sends calendar dates (e.g. "2026-08-30") with no time
// component, and the generated client parses them with `new Date(...)`,
// which the ES spec treats as UTC midnight. Formatting in the viewer's
// local timezone would then roll back a day west of UTC, so this reads
// the UTC calendar fields instead of the local ones.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

export function formatDate(date: Date | undefined): string | undefined {
	return date ? dateFormatter.format(date) : undefined;
}

export function formatPrice(price: number | undefined): string | undefined {
	return price != null ? `$${price.toFixed(2)}` : undefined;
}
