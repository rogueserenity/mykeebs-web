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

export function orderStatusIcon(status: string) {
	const key = status.toLowerCase();
	return key === 'all' ? undefined : statusIcons[key as StatusFilter];
}

// The pills' uppercasing is CSS, which a title attribute never sees.
export function statusFilterLabel(filter: StatusFilter): string {
	return filter.charAt(0).toUpperCase() + filter.slice(1);
}
