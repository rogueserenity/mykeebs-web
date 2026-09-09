<script lang="ts">
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type {
		Build,
		BuildInput,
		BuildKeycapKitEntry,
		BuildSwitchEntry,
		KeyboardSummary,
		KeycapSet,
		KeycapSetSummary,
		SwitchSummary
	} from '@rogueserenity/kbdb-api-client';
	import { Visibility } from '@rogueserenity/kbdb-api-client';
	import { lookupsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import { getUserContext } from '$lib/user-context';
	import ItemPicker, { type ItemPickerCache } from '$lib/components/ItemPicker.svelte';

	let {
		initial,
		saving,
		error,
		onSubmit,
		onCancel,
		onImageUpload,
		onImageRemove,
		// eslint-disable-next-line no-useless-assignment -- false positive: read externally via bind:dirty
		dirty = $bindable(false)
	}: {
		initial?: Build;
		saving: boolean;
		error: string | null;
		onSubmit: (input: BuildInput, stagedImages?: File[]) => void;
		onCancel: () => void;
		onImageUpload?: (file: File) => Promise<void>;
		onImageRemove?: (imageId: string) => Promise<void>;
		dirty?: boolean;
	} = $props();

	const userContext = getUserContext();

	// Each picker fully unmounts when closed, so without these its
	// ItemPicker would re-fetch the user's whole collection (with a fresh
	// presigned image URL per item) from scratch on every reopen -- over a
	// long editing session that repeatedly adds several switches or kits,
	// this piles up fast. One cache per resource type, shared across every
	// open of that picker for the lifetime of this form.
	const keyboardPickerCache: ItemPickerCache<KeyboardSummary> = { items: null };
	const switchPickerCache: ItemPickerCache<SwitchSummary> = { items: null };
	const keycapSetPickerCache: ItemPickerCache<KeycapSetSummary> = { items: null };

	// The keyboard picker only needs id/brand/name/image for display, but the
	// chosen keyboard's own `design.plates` list is needed to populate the
	// plate select — so the full Keyboard is fetched once a keyboard is
	// picked (or on load, for an existing build).
	type ChosenKeyboard = { id: string; brand: string; name: string; imageUrl?: string };
	let keyboard = $state<ChosenKeyboard | undefined>(
		initial?.keyboard
			? {
					id: initial.keyboard.id,
					brand: initial.keyboard.brand,
					name: initial.keyboard.name,
					imageUrl: initial.keyboard.imageUrl
				}
			: undefined
	);
	let keyboardPlates = $state<string[]>([]);
	let plate = $state(initial?.plate ?? '');
	let keyboardPickerOpen = $state(false);
	const refocusKeyboardTrigger = { value: false };

	async function loadKeyboardPlates(keyboardId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		try {
			const full = await keyboardsApi.getKeyboard({ userId, keyboardId });
			keyboardPlates = full.design?.plates ?? [];
		} catch {
			keyboardPlates = [];
		}
	}

	$effect(() => {
		if (keyboard) loadKeyboardPlates(keyboard.id);
	});

	function pickKeyboard(summary: KeyboardSummary) {
		keyboard = {
			id: summary.id ?? '',
			brand: summary.brand ?? '',
			name: summary.name ?? '',
			imageUrl: summary.image?.url
		};
		plate = '';
		keyboardPickerOpen = false;
		refocusKeyboardTrigger.value = true;
	}

	let caseMountType = $state(initial?.caseMountType?.type ?? '');
	let durometer = $state(initial?.caseMountType?.durometer ?? '');
	let stabsName = $state(initial?.stabs?.name ?? '');
	let stabsMountType = $state(initial?.stabs?.mountType ?? '');
	let stabsPrice = $state<number | undefined>(initial?.stabs?.price);
	let foam = $state(initial?.foam ?? false);
	// Defaults to today on a new build so the field always shows a real
	// date rather than each browser's own (inconsistent) empty-date
	// rendering -- Safari fills today's date automatically while
	// Chrome/Brave just show the mm/dd/yyyy placeholder. Editing an
	// existing build with no date set is left genuinely empty, since
	// that's the user's own data rather than a default to suggest.
	let buildDate = $state(initial ? toDateInput(initial.buildDate) : todayDateInput());
	let notes = $state(initial?.notes ?? '');
	let visibility = $state<Visibility>(initial?.visibility ?? Visibility.Private);

	// Seeded once from initial data and never bound again — each <details>
	// then owns its own open/closed state via the browser's native toggle,
	// so typing into a field inside it (which changes the summary text
	// below) can't force it to snap shut mid-edit.
	let caseMountOpen = $state(Boolean(initial?.caseMountType));
	let stabsOpen = $state(Boolean(initial?.stabs));

	// The API sends/receives plain calendar dates (no time component), and
	// the generated client parses them with `new Date(...)`, which the ES
	// spec treats as UTC midnight -- so this must read the UTC fields back
	// (toISOString(), same idea) to round-trip the same calendar day,
	// matching format.ts's formatDate.
	function toDateInput(date: Date | undefined): string {
		return date ? date.toISOString().slice(0, 10) : '';
	}

	// Today's *local* calendar date, for defaulting a new build's date
	// field. Unlike toDateInput above, this starts from a real timestamp
	// (not a UTC-midnight-encoded calendar date), so formatting it in UTC
	// would land on the wrong day for anyone west of UTC in the evening.
	function todayDateInput(): string {
		const now = new Date();
		const year = String(now.getFullYear()).padStart(4, '0');
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}

	type MountTypeValue = { name: string; supportsDurometer: boolean };
	let mountTypes = $state<MountTypeValue[]>([]);
	let stabNames = $state<string[]>([]);
	let stabMountTypes = $state<string[]>([]);
	let durometers = $state<string[]>([]);

	let supportsDurometer = $derived(
		mountTypes.find((m) => m.name === caseMountType)?.supportsDurometer ?? false
	);
	$effect(() => {
		if (!supportsDurometer) durometer = '';
	});

	function optionsWith(loaded: string[], current: string): string[] {
		return current && !loaded.includes(current) ? [current, ...loaded] : loaded;
	}

	// Closing a picker unmounts its "Done"/"Cancel" button, so focus would
	// otherwise silently drop to <body>. Pass this to `use:` on whatever
	// trigger button reappears in that spot (e.g. "+ Add switch"), along
	// with a "should I claim focus right now" flag the caller flips just
	// before the picker closes; the flag is consumed (reset) here so a
	// later unrelated remount of the same button doesn't steal focus again.
	function focusOnMount(node: HTMLElement, shouldFocus: { value: boolean }) {
		if (shouldFocus.value) {
			node.focus();
			shouldFocus.value = false;
		}
	}

	$effect(() => {
		Promise.all([
			lookupsApi.getLookup({ category: 'build_case_mount_type' }),
			lookupsApi.getLookup({ category: 'build_stabilizer' }),
			lookupsApi.getLookup({ category: 'build_stabilizer_mount_type' }),
			lookupsApi.getLookup({ category: 'build_durometer' })
		])
			.then(([mountLookup, stabLookup, stabMountLookup, durometerLookup]) => {
				mountTypes = (mountLookup.values as { name: string; supports_durometer: boolean }[]).map(
					(v) => ({ name: v.name, supportsDurometer: v.supports_durometer })
				);
				stabNames = stabLookup.values;
				stabMountTypes = stabMountLookup.values;
				durometers = durometerLookup.values;
			})
			.catch(() => {
				// Open-vocabulary suggestions are a nice-to-have; the fields
				// still work as free text if lookups fail to load.
			});
	});

	// Switches -- each entry is a switch id + count. Resolved refs (from an
	// existing build) are kept alongside so the list can render name/image
	// without a follow-up fetch; a freshly picked switch is resolved from
	// the picker's own SwitchSummary instead.
	type SwitchEntry = { switchId: string; count: number; label: string; imageUrl?: string };
	let switchEntries = $state<SwitchEntry[]>(
		(initial?.switches ?? [])
			.filter((entry) => entry._switch)
			.map((entry) => ({
				switchId: entry._switch!.id,
				count: entry.count,
				label: `${entry._switch!.name} (${entry._switch!.brand})`,
				imageUrl: entry._switch!.imageUrl
			}))
	);
	let switchPickerOpen = $state(false);
	const refocusSwitchTrigger = { value: false };
	let switchCountInputs = new SvelteMap<string, HTMLInputElement>();
	// Set right before the picker closes; the count-input's own {#each}
	// element action picks it up once that input exists in the DOM and
	// focuses+selects it, so the user can immediately type a quantity
	// without reaching for the mouse.
	let focusSwitchId = $state<string | null>(null);

	function addSwitch(sw: SwitchSummary) {
		const switchId = sw.id ?? '';
		const existing = switchEntries.find((e) => e.switchId === switchId);
		if (existing) {
			existing.count += 1;
		} else {
			switchEntries = [
				...switchEntries,
				{
					switchId,
					count: 1,
					label: `${sw.name} (${sw.brand})`,
					imageUrl: sw.image?.url
				}
			];
		}
		switchPickerOpen = false;
		focusSwitchId = switchId;
	}

	function focusCountInput(node: HTMLInputElement, switchId: string) {
		switchCountInputs.set(switchId, node);
		return {
			destroy() {
				switchCountInputs.delete(switchId);
			}
		};
	}

	$effect(() => {
		if (!focusSwitchId) return;
		// Already-existing rows (re-picking a switch just bumps its count)
		// don't remount, so the use: action above won't fire for them --
		// look the input up directly instead.
		const input = switchCountInputs.get(focusSwitchId);
		if (input) {
			input.focus();
			input.select();
		}
		focusSwitchId = null;
	});

	function removeSwitch(switchId: string) {
		switchEntries = switchEntries.filter((e) => e.switchId !== switchId);
		// The row (and its focused ✕ button) is gone once this re-renders,
		// which would otherwise drop focus to <body> -- send it somewhere
		// still on the page instead.
		refocusSwitchTrigger.value = true;
	}

	// Keycap kits -- each entry pairs a keycap set id with one of that set's
	// kit ids. Picking is two-step: choose a set, then choose one of its
	// kits (fetched fresh since listKeycapSets doesn't include kits[]).
	type KeycapKitEntryDisplay = {
		keycapSetId: string;
		kitId: string;
		label: string;
		imageUrl?: string;
	};
	let keycapKitEntries = $state<KeycapKitEntryDisplay[]>(
		(initial?.keycapKits ?? [])
			.filter((entry) => entry.keycapSet && entry.kitName)
			.map((entry) => ({
				keycapSetId: entry.keycapSet!.id,
				kitId: entry.kitId,
				label: `${entry.keycapSet!.name} — ${entry.kitName}`,
				imageUrl: entry.kitImageUrl
			}))
	);
	let keycapSetPickerOpen = $state(false);
	const refocusKeycapKitTrigger = { value: false };
	let kitPickerSet = $state<KeycapSet | null>(null);
	let kitPickerError = $state<string | null>(null);
	let kitPickerLoading = $state(false);

	async function pickKeycapSet(summary: KeycapSetSummary) {
		const userId = userContext.userId;
		if (!userId || !summary.id) return;

		keycapSetPickerOpen = false;
		kitPickerError = null;
		kitPickerLoading = true;
		kitPickerSet = null;
		try {
			kitPickerSet = await keycapSetsApi.getKeycapSet({ userId, keycapSetId: summary.id });
		} catch {
			kitPickerError = 'Could not load this keycap set.';
		} finally {
			kitPickerLoading = false;
		}
	}

	// Kits ticked in the current kitPickerSet's checklist, added together
	// via "Add selected" -- picking multiple kits from the same set (e.g.
	// a base + novelty kit) is the common case, so confirming one kit at a
	// time and losing the set's kit list each time would be tedious.
	// Cleared in place (never reassigned) so SvelteSet's own reactivity is
	// enough -- reassigning it would need an outer $state to stay tracked.
	const checkedKitIds = new SvelteSet<string>();

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- track kitPickerSet so switching sets clears the checklist
		kitPickerSet;
		checkedKitIds.clear();
	});

	function addSelectedKeycapKits() {
		if (!kitPickerSet) return;
		const set = kitPickerSet;
		const toAdd = (set.kits ?? []).filter(
			(kit) =>
				checkedKitIds.has(kit.kitId) &&
				!keycapKitEntries.some((e) => e.keycapSetId === set.id && e.kitId === kit.kitId)
		);
		if (toAdd.length > 0) {
			keycapKitEntries = [
				...keycapKitEntries,
				...toAdd.map((kit) => ({
					keycapSetId: set.id,
					kitId: kit.kitId,
					label: `${set.name} — ${kit.name}`,
					imageUrl: kit.image?.url
				}))
			];
		}
		kitPickerSet = null;
		refocusKeycapKitTrigger.value = true;
	}

	function removeKeycapKit(keycapSetId: string, kitId: string) {
		keycapKitEntries = keycapKitEntries.filter(
			(e) => !(e.keycapSetId === keycapSetId && e.kitId === kitId)
		);
		// See removeSwitch -- the removed row's focused ✕ button is gone
		// once this re-renders, so send focus somewhere still on the page.
		refocusKeycapKitTrigger.value = true;
	}

	let imageBusy = $state(false);
	let imageError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);
	let addPhotoButton = $state<HTMLButtonElement | null>(null);

	// On create there's no buildId yet to attach images to, so picked files
	// are staged locally (with object URL previews) and handed to onSubmit
	// alongside the form data — the parent uploads them once the build
	// exists.
	type StagedImage = { file: File; preview: string };
	let stagedImages = $state<StagedImage[]>([]);

	$effect(() => {
		return () => {
			for (const staged of stagedImages) URL.revokeObjectURL(staged.preview);
		};
	});

	function onImagePick(event: Event) {
		const files = Array.from((event.target as HTMLInputElement).files ?? []);
		if (files.length === 0) return;

		if (!initial) {
			stagedImages = [
				...stagedImages,
				...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))
			];
			if (fileInput) fileInput.value = '';
			return;
		}

		uploadImages(files);
	}

	async function uploadImages(files: File[]) {
		if (!onImageUpload) return;
		imageError = null;
		imageBusy = true;
		try {
			for (const file of files) await onImageUpload(file);
		} catch {
			imageError = 'Could not upload that image.';
		} finally {
			imageBusy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function removeStagedImage(index: number) {
		const [removed] = stagedImages.splice(index, 1);
		stagedImages = [...stagedImages];
		if (removed) URL.revokeObjectURL(removed.preview);
		// The removed thumbnail's focused ✕ button is gone once this
		// re-renders, so send focus somewhere still on the page.
		addPhotoButton?.focus();
	}

	async function removeImage(imageId: string) {
		if (!onImageRemove) return;
		imageError = null;
		imageBusy = true;
		try {
			await onImageRemove(imageId);
			addPhotoButton?.focus();
		} finally {
			imageBusy = false;
		}
	}

	// Drives the "discard changes?" prompt on an accidental close (see
	// Modal's `dirty` prop) -- true once anything meaningfully differs from
	// the snapshot the form opened with.
	const initialKeyboardId = initial?.keyboard?.id ?? '';
	const initialPlate = initial?.plate ?? '';
	const initialCaseMountType = initial?.caseMountType?.type ?? '';
	const initialDurometer = initial?.caseMountType?.durometer ?? '';
	const initialStabsName = initial?.stabs?.name ?? '';
	const initialStabsMountType = initial?.stabs?.mountType ?? '';
	const initialStabsPrice = initial?.stabs?.price;
	const initialFoam = initial?.foam ?? false;
	const initialBuildDate = initial ? toDateInput(initial.buildDate) : todayDateInput();
	const initialNotes = initial?.notes ?? '';
	const initialVisibility = initial?.visibility ?? Visibility.Private;
	const initialSwitchIds = switchEntries.map((e) => `${e.switchId}:${e.count}`).sort();
	const initialKeycapKitIds = keycapKitEntries.map((e) => `${e.keycapSetId}:${e.kitId}`).sort();

	$effect(() => {
		dirty =
			(keyboard?.id ?? '') !== initialKeyboardId ||
			plate !== initialPlate ||
			caseMountType !== initialCaseMountType ||
			durometer !== initialDurometer ||
			stabsName !== initialStabsName ||
			stabsMountType !== initialStabsMountType ||
			stabsPrice !== initialStabsPrice ||
			foam !== initialFoam ||
			buildDate !== initialBuildDate ||
			notes !== initialNotes ||
			visibility !== initialVisibility ||
			stagedImages.length > 0 ||
			JSON.stringify(switchEntries.map((e) => `${e.switchId}:${e.count}`).sort()) !==
				JSON.stringify(initialSwitchIds) ||
			JSON.stringify(keycapKitEntries.map((e) => `${e.keycapSetId}:${e.kitId}`).sort()) !==
				JSON.stringify(initialKeycapKitIds);
	});

	let validationError = $state<string | null>(null);

	// Pressing Enter in a single-line field (number/date/text) submits the
	// whole form by default -- surprising mid-way through a long form like
	// this one, where Enter more often means "confirm this field" than
	// "save everything." Textareas, buttons, and ItemPicker's own search
	// box (which uses Enter to pick the highlighted item) are left alone.
	function guardEnterSubmit(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		const target = event.target as HTMLElement;
		if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
		if (target.getAttribute('role') === 'combobox') return;
		event.preventDefault();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = null;

		if (!keyboard) {
			validationError = 'A keyboard is required.';
			return;
		}

		const hasCaseMountType = caseMountType.trim() || durometer.trim();
		const hasStabs = stabsName.trim() || stabsMountType.trim() || stabsPrice != null;

		const switches: BuildSwitchEntry[] = switchEntries.map((e) => ({
			_switch: e.switchId,
			count: e.count
		}));
		const keycapKits: BuildKeycapKitEntry[] = keycapKitEntries.map((e) => ({
			keycapSet: e.keycapSetId,
			kit: e.kitId
		}));

		const input: BuildInput = {
			keyboard: keyboard.id,
			plate: plate.trim() || undefined,
			caseMountType: hasCaseMountType
				? {
						type: caseMountType.trim() || undefined,
						durometer: durometer.trim() || undefined
					}
				: undefined,
			stabs: hasStabs
				? {
						name: stabsName.trim() || undefined,
						mountType: stabsMountType.trim() || undefined,
						price: stabsPrice
					}
				: undefined,
			foam: foam || undefined,
			switches: switches.length > 0 ? switches : undefined,
			keycapKits: keycapKits.length > 0 ? keycapKits : undefined,
			buildDate: buildDate.trim() ? new Date(buildDate.trim()) : undefined,
			notes: notes.trim() || undefined,
			visibility
		};

		onSubmit(
			input,
			stagedImages.length > 0 ? stagedImages.map((staged) => staged.file) : undefined
		);
	}
</script>

<!-- keydown here only guards against Enter submitting the form early -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form class="flex flex-col gap-5" onsubmit={handleSubmit} onkeydown={guardEnterSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit build' : 'Add build'}</h2>

	<div class="flex flex-col gap-2">
		<span class="field-label">Images</span>
		<div class="flex flex-wrap gap-3">
			{#if initial}
				{#each initial.images ?? [] as image (image.imageId)}
					<div class="relative">
						<img src={image.url} alt="Build" class="kc-thumb h-20 w-20 object-contain" />
						<button
							type="button"
							class="btn-icon absolute -top-2 -right-2 h-6 w-6 text-xs"
							disabled={imageBusy}
							aria-label="Remove image"
							onclick={() => removeImage(image.imageId)}
						>
							✕
						</button>
					</div>
				{/each}
			{:else}
				{#each stagedImages as staged, index (staged.preview)}
					<div class="relative">
						<img
							src={staged.preview}
							alt="Selected build"
							class="kc-thumb h-20 w-20 object-contain"
						/>
						<button
							type="button"
							class="btn-icon absolute -top-2 -right-2 h-6 w-6 text-xs"
							aria-label="Remove image"
							onclick={() => removeStagedImage(index)}
						>
							✕
						</button>
					</div>
				{/each}
			{/if}
			<button
				bind:this={addPhotoButton}
				type="button"
				class="btn"
				disabled={imageBusy}
				onclick={() => fileInput?.click()}
			>
				{imageBusy ? 'Working…' : '+ Add photo'}
			</button>
		</div>
		{#if imageError}
			<span class="text-xs" style="color: var(--danger)">{imageError}</span>
		{/if}
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			class="hidden"
			onchange={onImagePick}
		/>
	</div>

	<div class="flex flex-col gap-1.5">
		<span class="field-label">Keyboard <span style="color: var(--danger)">*</span></span>
		{#if keyboard && !keyboardPickerOpen}
			<div class="kc-card flex items-center gap-3 p-3">
				{#if keyboard.imageUrl}
					<img
						src={keyboard.imageUrl}
						alt={keyboard.name}
						class="kc-thumb h-12 w-12 shrink-0 object-contain"
					/>
				{/if}
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium">{keyboard.name}</p>
					<p class="text-muted truncate text-xs">{keyboard.brand}</p>
				</div>
				<button
					type="button"
					class="btn"
					use:focusOnMount={refocusKeyboardTrigger}
					onclick={() => (keyboardPickerOpen = true)}
				>
					Change
				</button>
			</div>
		{:else if keyboardPickerOpen}
			<ItemPicker
				userId={userContext.userId}
				fetchPage={(userId, cursor) => keyboardsApi.listKeyboards({ userId, cursor })}
				itemKey={(kb) => kb.id ?? ''}
				getLabel={(kb) => kb.name}
				getSublabel={(kb) => kb.brand}
				getImageUrl={(kb) => kb.image?.url}
				placeholder="Search keyboards…"
				cache={keyboardPickerCache}
				onPick={pickKeyboard}
				onCancel={keyboard
					? () => {
							keyboardPickerOpen = false;
							refocusKeyboardTrigger.value = true;
						}
					: undefined}
			/>
			{#if keyboard}
				<button
					type="button"
					class="btn self-start"
					onclick={() => {
						keyboardPickerOpen = false;
						refocusKeyboardTrigger.value = true;
					}}
				>
					Cancel
				</button>
			{/if}
		{:else}
			<button
				type="button"
				class="btn"
				data-autofocus
				use:focusOnMount={refocusKeyboardTrigger}
				onclick={() => (keyboardPickerOpen = true)}
			>
				Choose keyboard…
			</button>
		{/if}
	</div>

	{#if keyboard && keyboardPlates.length > 0}
		<label class="flex flex-col gap-1.5">
			<span class="field-label">Plate</span>
			<select class="field-select w-full" bind:value={plate}>
				<option value="">—</option>
				{#each optionsWith(keyboardPlates, plate) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>
	{/if}

	<details class="field-group" bind:open={caseMountOpen}>
		<summary>
			Case mount
			<span class="field-group-hint"
				>— {[caseMountType, durometer].filter(Boolean).join(' · ') || 'Not set'}</span
			>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Mount type</span>
				<select class="field-select w-full" bind:value={caseMountType}>
					<option value="">—</option>
					{#each optionsWith( mountTypes.map((m) => m.name), caseMountType ) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			{#if supportsDurometer}
				<label class="flex flex-col gap-1.5">
					<span class="field-label">Durometer</span>
					<select class="field-select w-full" bind:value={durometer}>
						<option value="">—</option>
						{#each optionsWith(durometers, durometer) as value (value)}
							<option {value}>{value}</option>
						{/each}
					</select>
				</label>
			{/if}
		</div>
	</details>

	<details class="field-group" bind:open={stabsOpen}>
		<summary>
			Stabilizers
			<span class="field-group-hint">— {stabsName.trim() || 'Not set'}</span>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Name</span>
				<select class="field-select w-full" bind:value={stabsName}>
					<option value="">—</option>
					{#each optionsWith(stabNames, stabsName) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Mount type</span>
				<select class="field-select w-full" bind:value={stabsMountType}>
					<option value="">—</option>
					{#each optionsWith(stabMountTypes, stabsMountType) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Price</span>
				<input type="number" class="field-input" min="0" step="0.01" bind:value={stabsPrice} />
			</label>
		</div>
	</details>

	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" class="field-checkbox" bind:checked={foam} />
		Foam
	</label>

	<div class="flex flex-col gap-1.5">
		<span class="field-label">Switches</span>
		{#if switchEntries.length > 0}
			<ul class="flex flex-col gap-2">
				{#each switchEntries as entry (entry.switchId)}
					<li class="kc-card flex items-center gap-3 p-2">
						{#if entry.imageUrl}
							<img src={entry.imageUrl} alt="" class="kc-thumb h-8 w-8 shrink-0 object-contain" />
						{/if}
						<span class="min-w-0 flex-1 truncate text-sm">{entry.label}</span>
						<input
							type="number"
							class="field-input w-20"
							min="1"
							step="1"
							bind:value={entry.count}
							use:focusCountInput={entry.switchId}
						/>
						<button
							type="button"
							class="btn-icon h-7 w-7 text-xs"
							aria-label="Remove switch"
							onclick={() => removeSwitch(entry.switchId)}
						>
							✕
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if switchPickerOpen}
			<ItemPicker
				userId={userContext.userId}
				fetchPage={(userId, cursor) => switchesApi.listSwitches({ userId, cursor })}
				itemKey={(sw) => sw.id ?? ''}
				getLabel={(sw) => sw.name}
				getSublabel={(sw) => sw.brand}
				getImageUrl={(sw) => sw.image?.url}
				placeholder="Search switches…"
				cache={switchPickerCache}
				onPick={addSwitch}
				onCancel={() => {
					switchPickerOpen = false;
					refocusSwitchTrigger.value = true;
				}}
			/>
			<button
				type="button"
				class="btn self-start"
				onclick={() => {
					switchPickerOpen = false;
					refocusSwitchTrigger.value = true;
				}}
			>
				Done
			</button>
		{:else}
			<button
				type="button"
				class="btn self-start"
				use:focusOnMount={refocusSwitchTrigger}
				onclick={() => (switchPickerOpen = true)}
			>
				+ Add switch
			</button>
		{/if}
	</div>

	<div class="flex flex-col gap-1.5">
		<span class="field-label">Keycap kits</span>
		{#if keycapKitEntries.length > 0}
			<ul class="flex flex-col gap-2">
				{#each keycapKitEntries as entry (entry.keycapSetId + entry.kitId)}
					<li class="kc-card flex items-center gap-3 p-2">
						{#if entry.imageUrl}
							<img src={entry.imageUrl} alt="" class="kc-thumb h-8 w-8 shrink-0 object-contain" />
						{/if}
						<span class="min-w-0 flex-1 truncate text-sm">{entry.label}</span>
						<button
							type="button"
							class="btn-icon h-7 w-7 text-xs"
							aria-label="Remove keycap kit"
							onclick={() => removeKeycapKit(entry.keycapSetId, entry.kitId)}
						>
							✕
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		{#if kitPickerLoading}
			<p class="text-muted text-sm">Loading kits&hellip;</p>
		{:else if kitPickerError}
			<p class="text-sm" style="color: var(--danger)">{kitPickerError}</p>
		{:else if kitPickerSet}
			{@const set = kitPickerSet}
			<div class="flex flex-col gap-2">
				<p class="text-muted text-sm">Pick kits from "{set.name}":</p>
				{#if set.kits && set.kits.length > 0}
					<ul class="flex flex-col gap-2">
						{#each set.kits as kit, index (kit.kitId)}
							{@const alreadyAdded = keycapKitEntries.some(
								(e) => e.keycapSetId === set.id && e.kitId === kit.kitId
							)}
							<li>
								<label
									class="kc-picker-row flex w-full items-center gap-3 rounded border p-2 {alreadyAdded
										? 'opacity-50'
										: ''}"
									style="border-color: var(--border)"
								>
									<input
										type="checkbox"
										class="field-checkbox"
										disabled={alreadyAdded}
										checked={alreadyAdded || checkedKitIds.has(kit.kitId)}
										use:focusOnMount={index === 0 && !alreadyAdded
											? { value: true }
											: { value: false }}
										onchange={(event) => {
											if (event.currentTarget.checked) checkedKitIds.add(kit.kitId);
											else checkedKitIds.delete(kit.kitId);
										}}
									/>
									{#if kit.image?.url}
										<img
											src={kit.image.url}
											alt=""
											class="kc-thumb h-8 w-8 shrink-0 object-contain"
										/>
									{/if}
									<span class="text-sm">{kit.name}</span>
									{#if alreadyAdded}
										<span class="text-faint ml-auto text-xs">Added</span>
									{/if}
								</label>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-muted text-sm">This set has no kits.</p>
				{/if}
				<div class="flex gap-2">
					<button
						type="button"
						class="btn btn-accent"
						disabled={checkedKitIds.size === 0}
						onclick={addSelectedKeycapKits}
					>
						Add selected
					</button>
					<button
						type="button"
						class="btn"
						onclick={() => {
							kitPickerSet = null;
							refocusKeycapKitTrigger.value = true;
						}}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else if keycapSetPickerOpen}
			<ItemPicker
				userId={userContext.userId}
				fetchPage={(userId, cursor) => keycapSetsApi.listKeycapSets({ userId, cursor })}
				itemKey={(set) => set.id ?? ''}
				getLabel={(set) => set.name}
				getSublabel={(set) => set.brand}
				getImageUrl={(set) => set.primaryKitImage?.url}
				placeholder="Search keycap sets…"
				cache={keycapSetPickerCache}
				onPick={pickKeycapSet}
				onCancel={() => {
					keycapSetPickerOpen = false;
					refocusKeycapKitTrigger.value = true;
				}}
			/>
			<button
				type="button"
				class="btn self-start"
				onclick={() => {
					keycapSetPickerOpen = false;
					refocusKeycapKitTrigger.value = true;
				}}
			>
				Done
			</button>
		{:else}
			<button
				type="button"
				class="btn self-start"
				use:focusOnMount={refocusKeycapKitTrigger}
				onclick={() => (keycapSetPickerOpen = true)}
			>
				+ Add keycap kit
			</button>
		{/if}
	</div>

	<label class="flex flex-col gap-1.5">
		<span class="field-label">Build date</span>
		<input type="date" class="field-input w-56" bind:value={buildDate} />
	</label>

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
			{saving ? 'Saving…' : initial ? 'Save changes' : 'Add build'}
		</button>
		<button type="button" class="btn" disabled={saving} onclick={onCancel}>Cancel</button>
	</div>
</form>
