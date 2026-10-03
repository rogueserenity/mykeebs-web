<script lang="ts">
	let { builds, onCancel }: { builds: string[]; onCancel: () => void } = $props();
</script>

<span class="text-sm" style="color: var(--danger)">
	Used in: {builds.join(', ')}. Remove it from those builds first.
</span>
<button type="button" class="btn" onclick={onCancel}>Cancel</button>
