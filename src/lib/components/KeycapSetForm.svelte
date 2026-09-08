<script lang="ts">
	import type { KeycapSet, KeycapSetInput } from '@rogueserenity/kbdb-api-client';
	import { Visibility } from '@rogueserenity/kbdb-api-client';
	import { lookupsApi } from '$lib/api/client';

	let {
		initial,
		saving,
		error,
		onSubmit,
		onCancel
	}: {
		initial?: KeycapSet;
		saving: boolean;
		error: string | null;
		onSubmit: (input: KeycapSetInput) => void;
		onCancel: () => void;
	} = $props();

	let brand = $state(initial?.brand ?? '');
	let name = $state(initial?.name ?? '');
	let profile = $state(initial?.profile ?? '');
	let material = $state(initial?.material ?? '');
	let notes = $state(initial?.notes ?? '');
	let visibility = $state<Visibility>(initial?.visibility ?? Visibility.Private);

	let profiles = $state<string[]>([]);
	let materials = $state<string[]>([]);

	// Closed sets validated server-side against the matching lookup. The
	// current value is always included even before the lookup loads (or if
	// it's since been retired from the list), so editing never silently
	// clears a value the set already has.
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
			.catch(() => {
				// Open-vocabulary suggestions are a nice-to-have; the fields
				// still work as free text if lookups fail to load.
			});
	});

	let validationError = $state<string | null>(null);

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

<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit keycap set' : 'Add keycap set'}</h2>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5">
			<span class="field-label">Brand <span style="color: var(--danger)">*</span></span>
			<input type="text" class="field-input" bind:value={brand} autocomplete="off" />
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

	<label class="flex flex-col gap-1.5">
		<span class="field-label">Visibility</span>
		<select class="field-select w-56" bind:value={visibility}>
			<option value={Visibility.Private}>Private</option>
			<option value={Visibility.Authenticated}>Signed-in users</option>
			<option value={Visibility.Public}>Public</option>
		</select>
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
