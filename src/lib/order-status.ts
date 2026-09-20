import { Ban, ClipboardList, FunnelX, Package, ShoppingBag, Truck } from 'lucide-svelte';

export const STATUS_FILTERS = [
	'all',
	'planned',
	'ordered',
	'shipped',
	'delivered',
	'cancelled'
] as const;

export type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusIcons = {
	all: FunnelX,
	planned: ClipboardList,
	ordered: ShoppingBag,
	shipped: Truck,
	delivered: Package,
	cancelled: Ban
} satisfies Record<StatusFilter, unknown>;

export function statusFilterIcon(filter: StatusFilter) {
	return statusIcons[filter];
}

// The API returns these capitalized ("Delivered"), and an unrecognized
// value renders as a plain dot rather than a wrong icon.
export function orderStatusIcon(status: string) {
	const key = status.toLowerCase();
	return key === 'all' ? undefined : statusIcons[key as StatusFilter];
}

// Capitalized to match how the API returns these ("Delivered"), and because
// the pills' uppercasing is CSS, which a title attribute never sees.
export function statusFilterLabel(filter: StatusFilter): string {
	return filter.charAt(0).toUpperCase() + filter.slice(1);
}
