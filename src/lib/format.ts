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

const dateFormatter = new Intl.DateTimeFormat('en-US', {
	year: 'numeric',
	month: 'short',
	day: 'numeric'
});

export function formatDate(date: Date | undefined): string | undefined {
	return date ? dateFormatter.format(date) : undefined;
}

export function formatPrice(price: number | undefined): string | undefined {
	return price != null ? `$${price.toFixed(2)}` : undefined;
}
