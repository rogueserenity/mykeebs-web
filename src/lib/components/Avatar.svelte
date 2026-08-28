<script lang="ts">
	let {
		name,
		imageUrl,
		size = 'sm'
	}: {
		name: string;
		imageUrl?: string;
		size?: 'sm' | 'lg';
	} = $props();

	function initials(value: string): string {
		return value.trim().slice(0, 2).toUpperCase();
	}
</script>

<span class="avatar avatar-{size}">
	{#if imageUrl}
		<img src={imageUrl} alt={name} />
	{:else}
		{initials(name)}
	{/if}
</span>
