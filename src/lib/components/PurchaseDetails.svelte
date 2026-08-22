<script lang="ts">
	import { formatDate, formatPrice, orderStatusClass } from '$lib/format';

	let {
		purchase
	}: {
		purchase:
			| {
					vendor?: string;
					price?: number;
					quantity?: number;
					orderDate?: Date;
					deliveryDate?: Date;
					orderStatus?: string;
			  }
			| undefined;
	} = $props();
</script>

{#if purchase}
	{#if purchase.orderStatus}
		<span class="mt-2 badge {orderStatusClass(purchase.orderStatus)}">
			{purchase.orderStatus}
		</span>
	{/if}
	<dl class="mt-4 space-y-2 text-sm">
		{#if purchase.vendor}
			<div class="flex justify-between gap-4">
				<dt class="opacity-75">Vendor</dt>
				<dd>{purchase.vendor}</dd>
			</div>
		{/if}
		{#if purchase.quantity != null}
			<div class="flex justify-between gap-4">
				<dt class="opacity-75">Quantity</dt>
				<dd>{purchase.quantity}</dd>
			</div>
		{/if}
		{#if formatPrice(purchase.price)}
			<div class="flex justify-between gap-4">
				<dt class="opacity-75">Price</dt>
				<dd>{formatPrice(purchase.price)}</dd>
			</div>
		{/if}
		{#if formatDate(purchase.orderDate)}
			<div class="flex justify-between gap-4">
				<dt class="opacity-75">Ordered</dt>
				<dd>{formatDate(purchase.orderDate)}</dd>
			</div>
		{/if}
		{#if formatDate(purchase.deliveryDate)}
			<div class="flex justify-between gap-4">
				<dt class="opacity-75">Delivered</dt>
				<dd>{formatDate(purchase.deliveryDate)}</dd>
			</div>
		{/if}
	</dl>
{/if}
