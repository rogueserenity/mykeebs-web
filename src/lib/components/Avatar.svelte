<script lang="ts">
	let {
		name,
		imageUrl,
		size = 'sm',
		label
	}: {
		name: string;
		imageUrl?: string;
		size?: 'sm' | 'lg';
		// Only where the avatar is the subject; elsewhere the name sits beside it.
		label?: string;
	} = $props();

	function initials(value: string): string {
		return value.trim().slice(0, 2).toUpperCase();
	}
</script>

<span
	class="avatar avatar-{size}"
	role={label && !imageUrl ? 'img' : undefined}
	aria-label={label && !imageUrl ? label : undefined}
>
	{#if imageUrl}
		<img src={imageUrl} alt={label ?? ''} decoding="async" />
	{:else}
		<span aria-hidden="true">{initials(name)}</span>
	{/if}
</span>
