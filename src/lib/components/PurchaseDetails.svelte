<script lang="ts">
	import { formatDate, formatPrice, orderStatusClass, type PurchaseLike } from '$lib/format';

	let { purchase }: { purchase: PurchaseLike | undefined } = $props();
</script>

{#if purchase}
	{#if purchase.orderStatus}
		<span class="status-badge mt-2 {orderStatusClass(purchase.orderStatus)}">
			{purchase.orderStatus}
		</span>
	{/if}
	<dl class="spec-list mt-4">
		{#if purchase.vendor}
			<div class="spec-row">
				<dt>Vendor</dt>
				<span class="spec-leader"></span>
				<dd>{purchase.vendor}</dd>
			</div>
		{/if}
		{#if purchase.quantity != null}
			<div class="spec-row">
				<dt>Quantity</dt>
				<span class="spec-leader"></span>
				<dd>{purchase.quantity}</dd>
			</div>
		{/if}
		{#if formatPrice(purchase.price)}
			<div class="spec-row">
				<dt>Price</dt>
				<span class="spec-leader"></span>
				<dd>{formatPrice(purchase.price)}</dd>
			</div>
		{/if}
		{#if formatDate(purchase.orderDate)}
			<div class="spec-row">
				<dt>Ordered</dt>
				<span class="spec-leader"></span>
				<dd>{formatDate(purchase.orderDate)}</dd>
			</div>
		{/if}
		{#if formatDate(purchase.deliveryDate)}
			<div class="spec-row">
				<dt>Delivered</dt>
				<span class="spec-leader"></span>
				<dd>{formatDate(purchase.deliveryDate)}</dd>
			</div>
		{/if}
	</dl>
{/if}
