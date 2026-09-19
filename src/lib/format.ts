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

// API calendar dates parse as UTC midnight, so formatting in local time
// would roll back a day west of UTC.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'short',
	day: 'numeric',
	timeZone: 'UTC'
});

export function formatDate(date: Date | undefined): string | undefined {
	return date ? dateFormatter.format(date) : undefined;
}

const priceFormatters = new Map<string, Intl.NumberFormat>();

function priceFormatterFor(currency: string): Intl.NumberFormat {
	let formatter = priceFormatters.get(currency);
	if (!formatter) {
		formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
		priceFormatters.set(currency, formatter);
	}
	return formatter;
}

export function formatPrice(price: number | undefined, currency: string): string | undefined {
	return price != null ? priceFormatterFor(currency).format(price) : undefined;
}
