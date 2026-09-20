<script lang="ts">
	import type { KeycapSet, KeycapSetInput } from '@rogueserenity/kbdb-api-client';
	import { Visibility } from '@rogueserenity/kbdb-api-client';
	import VisibilityPicker from './VisibilityPicker.svelte';
	import { lookupsApi } from '$lib/api/client';

	let {
		initial,
		saving,
		error,
		onSubmit,
		onCancel,
		// eslint-disable-next-line no-useless-assignment -- false positive: read externally via bind:dirty
		dirty = $bindable(false)
	}: {
		initial?: KeycapSet;
		saving: boolean;
		error: string | null;
		onSubmit: (input: KeycapSetInput) => void;
		onCancel: () => void;
		dirty?: boolean;
	} = $props();

	let brand = $state(initial?.brand ?? '');
	let name = $state(initial?.name ?? '');
	let profile = $state(initial?.profile ?? '');
	let material = $state(initial?.material ?? '');
	let notes = $state(initial?.notes ?? '');
	let visibility = $state<Visibility>(initial?.visibility ?? Visibility.Private);

	let profiles = $state<string[]>([]);
	let materials = $state<string[]>([]);

	function optionsWith(loaded: string[], current: string): string[] {
		return current && !loaded.includes(current) ? [current, ...loaded] : loaded;
	}

	$effect(() => {
		Promise.all([
			lookupsApi.getLookup({ category: 'keycap_profile' }),
			lookupsApi.getLookup({ category: 'keycap_material' })
		])
			.then(([profileLookup, materialLookup]) => {
				profiles = profileLookup.values;
				materials = materialLookup.values;
			})
			// Lookups only populate suggestions; the fields work without them.
			.catch(() => {});
	});

	const initialBrand = initial?.brand ?? '';
	const initialName = initial?.name ?? '';
	const initialProfile = initial?.profile ?? '';
	const initialMaterial = initial?.material ?? '';
	const initialNotes = initial?.notes ?? '';
	const initialVisibility = initial?.visibility ?? Visibility.Private;

	$effect(() => {
		dirty =
			brand !== initialBrand ||
			name !== initialName ||
			profile !== initialProfile ||
			material !== initialMaterial ||
			notes !== initialNotes ||
			visibility !== initialVisibility;
	});

	let validationError = $state<string | null>(null);

	function guardEnterSubmit(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		const target = event.target as HTMLElement;
		if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
		event.preventDefault();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = null;

		if (!brand.trim() || !name.trim()) {
			validationError = 'Brand and name are required.';
			return;
		}

		const input: KeycapSetInput = {
			brand: brand.trim(),
			name: name.trim(),
			profile: profile.trim() || undefined,
			material: material.trim() || undefined,
			notes: notes.trim() || undefined,
			visibility
		};

		onSubmit(input);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form class="flex flex-col gap-5" onsubmit={handleSubmit} onkeydown={guardEnterSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit keycap set' : 'Add keycap set'}</h2>

	<fieldset class="flex flex-col items-start gap-1.5">
		<legend class="field-label mb-1.5">Visibility</legend>
		<VisibilityPicker bind:value={visibility} />
	</fieldset>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5">
			<span class="field-label">Brand <span style="color: var(--danger)">*</span></span>
			<input type="text" class="field-input" bind:value={brand} autocomplete="off" data-autofocus />
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Name <span style="color: var(--danger)">*</span></span>
			<input type="text" class="field-input" bind:value={name} autocomplete="off" />
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Profile</span>
			<select class="field-select w-full" bind:value={profile}>
				<option value="">—</option>
				{#each optionsWith(profiles, profile) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Material</span>
			<select class="field-select w-full" bind:value={material}>
				<option value="">—</option>
				{#each optionsWith(materials, material) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>
	</div>

	<label class="flex flex-col gap-1.5">
		<span class="field-label">Notes</span>
		<textarea class="field-input" rows="5" maxlength="1000" bind:value={notes}></textarea>
	</label>

	{#if validationError}
		<p class="text-sm" style="color: var(--danger)">{validationError}</p>
	{/if}
	{#if error}
		<p class="text-sm" style="color: var(--danger)">{error}</p>
	{/if}

	<div class="mt-2 flex gap-2">
		<button type="submit" class="btn btn-accent" disabled={saving}>
			{saving ? 'Saving…' : initial ? 'Save changes' : 'Add keycap set'}
		</button>
		<button type="button" class="btn" disabled={saving} onclick={onCancel}>Cancel</button>
	</div>
</form>
