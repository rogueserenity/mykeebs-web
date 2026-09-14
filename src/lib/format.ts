export type PurchaseLike = {
	vendor?: string;
	price?: number;
	quantity?: number;
	orderDate?: Date;
	deliveryDate?: Date;
	orderStatus?: string;
};

const orderStatusColors: Record<string, string> = {
	planned: 'status-planned',
	ordered: 'status-ordered',
	shipped: 'status-shipped',
	delivered: 'status-delivered',
	cancelled: 'status-cancelled',
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

// Cached per currency code rather than rebuilt on every call.
const priceFormatters = new Map<string, Intl.NumberFormat>();

function priceFormatterFor(currency: string): Intl.NumberFormat {
	let formatter = priceFormatters.get(currency);
	if (!formatter) {
		formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
		priceFormatters.set(currency, formatter);
	}
	return formatter;
}

// The currency is always the item owner's preference, never the viewer's -
// a price is only ever shown alongside other items from the same owner.
export function formatPrice(price: number | undefined, currency: string): string | undefined {
	return price != null ? priceFormatterFor(currency).format(price) : undefined;
}
