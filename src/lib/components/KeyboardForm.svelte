<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Keyboard, KeyboardInput } from '@rogueserenity/kbdb-api-client';
	import { Visibility } from '@rogueserenity/kbdb-api-client';
	import { lookupsApi } from '$lib/api/client';

	let {
		initial,
		saving,
		error,
		onSubmit,
		onCancel,
		onImageUpload,
		onImageRemove
	}: {
		initial?: Keyboard;
		saving: boolean;
		error: string | null;
		onSubmit: (input: KeyboardInput, stagedImages?: File[]) => void;
		onCancel: () => void;
		onImageUpload?: (file: File) => Promise<void>;
		onImageRemove?: (imageId: string) => Promise<void>;
	} = $props();

	let brand = $state(initial?.brand ?? '');
	let name = $state(initial?.name ?? '');
	let size = $state(initial?.size ?? '');
	let layout = $state(initial?.layout ?? '');
	let topCaseMaterial = $state(initial?.design?.topCase?.material ?? '');
	let topCaseColor = $state(initial?.design?.topCase?.color ?? '');
	let bottomCaseMaterial = $state(initial?.design?.bottomCase?.material ?? '');
	let bottomCaseColor = $state(initial?.design?.bottomCase?.color ?? '');
	let weightMaterial = $state(initial?.design?.weight?.material ?? '');
	let weightColor = $state(initial?.design?.weight?.color ?? '');
	let plates = new SvelteSet<string>(initial?.design?.plates ?? []);
	let thickness = $state<number | undefined>(initial?.pcb?.thickness);
	let firmware = $state(initial?.pcb?.firmware ?? '');
	let assembly = $state(initial?.pcb?.assembly ?? '');
	let connectivity = $state(initial?.pcb?.connectivity ?? '');
	let vendor = $state(initial?.purchase?.vendor ?? '');
	let price = $state<number | undefined>(initial?.purchase?.price);
	let orderDate = $state(toDateInput(initial?.purchase?.orderDate));
	let deliveryDate = $state(toDateInput(initial?.purchase?.deliveryDate));
	let orderStatus = $state(initial?.purchase?.orderStatus ?? '');
	let notes = $state(initial?.notes ?? '');
	let visibility = $state<Visibility>(initial?.visibility ?? Visibility.Private);

	let showOrderDate = $derived(
		orderStatus.trim() !== '' && orderStatus.trim().toLowerCase() !== 'planned'
	);
	let isDelivered = $derived(orderStatus.trim().toLowerCase() === 'delivered');

	$effect(() => {
		if (!showOrderDate) orderDate = '';
	});
	$effect(() => {
		if (!isDelivered) deliveryDate = '';
	});

	// Seeded once from initial data and never bound again — each <details>
	// then owns its own open/closed state via the browser's native toggle,
	// so typing into a field inside it (which changes the summary text
	// below) can't force it to snap shut mid-edit.
	let designOpen = $state(Boolean(initial?.design));
	let pcbOpen = $state(Boolean(initial?.pcb));
	let purchaseOpen = $state(Boolean(initial?.purchase));

	let designSummary = $derived(
		[
			topCaseColor.trim() || topCaseMaterial.trim() ? 'top case' : undefined,
			bottomCaseColor.trim() || bottomCaseMaterial.trim() ? 'bottom case' : undefined,
			weightColor.trim() || weightMaterial.trim() ? 'weight' : undefined,
			plates.size > 0 ? `${plates.size} plate${plates.size === 1 ? '' : 's'}` : undefined
		]
			.filter(Boolean)
			.join(' · ') || 'Not set'
	);
	let pcbSummary = $derived(
		[firmware.trim() || undefined, connectivity.trim() || undefined].filter(Boolean).join(' · ') ||
			'Not set'
	);
	let purchaseSummary = $derived(
		[vendor.trim() || undefined, orderStatus.trim() || undefined].filter(Boolean).join(' · ') ||
			'Not set'
	);

	function toDateInput(date: Date | undefined): string {
		return date ? date.toISOString().slice(0, 10) : '';
	}

	type LayoutValue = { name: string; sizes: string[] };

	let keyboardSizes = $state<string[]>([]);
	let allLayouts = $state<LayoutValue[]>([]);
	let caseMaterials = $state<string[]>([]);
	let weightMaterials = $state<string[]>([]);
	let plateMaterials = $state<string[]>([]);
	let firmwares = $state<string[]>([]);
	let assemblies = $state<string[]>([]);
	let connectivities = $state<string[]>([]);
	let vendors = $state<string[]>([]);
	let orderStatuses = $state<string[]>([]);

	// Layout options narrow to whichever layouts support the selected size;
	// the current layout is always included even if it wouldn't otherwise
	// match, so editing never silently clears a value the keyboard already
	// has.
	let availableLayouts = $derived(
		size
			? allLayouts.filter((l) => l.sizes.includes(size)).map((l) => l.name)
			: allLayouts.map((l) => l.name)
	);

	$effect(() => {
		if (size && layout && !availableLayouts.includes(layout)) layout = '';
	});

	// Closed sets validated server-side against the matching lookup. The
	// current value(s) are always included even before the lookup loads (or
	// if they've since been retired from the list), so editing never
	// silently clears a value the keyboard already has.
	function optionsWith(loaded: string[], current: string): string[];
	function optionsWith(loaded: string[], current: string[]): string[];
	function optionsWith(loaded: string[], current: string | string[]): string[] {
		const missing = (Array.isArray(current) ? current : [current]).filter(
			(v) => v && !loaded.includes(v)
		);
		return missing.length > 0 ? [...missing, ...loaded] : loaded;
	}

	$effect(() => {
		Promise.all([
			lookupsApi.getLookup({ category: 'keyboard_size' }),
			lookupsApi.getLookup({ category: 'keyboard_layout' }),
			lookupsApi.getLookup({ category: 'keyboard_case_material' }),
			lookupsApi.getLookup({ category: 'keyboard_weight_material' }),
			lookupsApi.getLookup({ category: 'keyboard_plate_material' }),
			lookupsApi.getLookup({ category: 'keyboard_pcb_firmware' }),
			lookupsApi.getLookup({ category: 'keyboard_pcb_assembly_type' }),
			lookupsApi.getLookup({ category: 'keyboard_pcb_connectivity_type' }),
			lookupsApi.getLookup({ category: 'vendor' }),
			lookupsApi.getLookup({ category: 'order_status' })
		])
			.then(
				([
					sizeLookup,
					layoutLookup,
					caseMaterial,
					weightMaterialLookup,
					plateMaterial,
					firmwareLookup,
					assemblyLookup,
					connectivityLookup,
					vendorLookup,
					statusLookup
				]) => {
					keyboardSizes = sizeLookup.values;
					allLayouts = layoutLookup.values as LayoutValue[];
					caseMaterials = caseMaterial.values;
					weightMaterials = weightMaterialLookup.values;
					plateMaterials = plateMaterial.values;
					firmwares = firmwareLookup.values;
					assemblies = assemblyLookup.values;
					connectivities = connectivityLookup.values;
					vendors = vendorLookup.values;
					orderStatuses = statusLookup.values;
				}
			)
			.catch(() => {
				// Open-vocabulary suggestions are a nice-to-have; the fields
				// still work as free text if lookups fail to load.
			});
	});

	let imageBusy = $state(false);
	let imageError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	// On create there's no keyboardId yet to attach images to, so picked
	// files are staged locally (with object URL previews) and handed to
	// onSubmit alongside the form data — the parent uploads them once the
	// keyboard exists.
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
	}

	async function removeImage(imageId: string) {
		if (!onImageRemove) return;
		imageError = null;
		imageBusy = true;
		try {
			await onImageRemove(imageId);
		} finally {
			imageBusy = false;
		}
	}

	let validationError = $state<string | null>(null);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = null;

		if (!brand.trim() || !name.trim()) {
			validationError = 'Brand and name are required.';
			return;
		}

		const hasTopCase = topCaseMaterial.trim() || topCaseColor.trim();
		const hasBottomCase = bottomCaseMaterial.trim() || bottomCaseColor.trim();
		const hasWeight = weightMaterial.trim() || weightColor.trim();
		const plateList = [...plates];
		const hasDesign = hasTopCase || hasBottomCase || hasWeight || plateList.length > 0;

		const hasPcb = thickness != null || firmware.trim() || assembly.trim() || connectivity.trim();

		const hasPurchase =
			vendor.trim() ||
			price != null ||
			orderDate.trim() ||
			deliveryDate.trim() ||
			orderStatus.trim();

		const input: KeyboardInput = {
			brand: brand.trim(),
			name: name.trim(),
			size: size.trim() || undefined,
			layout: layout.trim() || undefined,
			design: hasDesign
				? {
						topCase: hasTopCase
							? {
									material: topCaseMaterial.trim() || undefined,
									color: topCaseColor.trim() || undefined
								}
							: undefined,
						bottomCase: hasBottomCase
							? {
									material: bottomCaseMaterial.trim() || undefined,
									color: bottomCaseColor.trim() || undefined
								}
							: undefined,
						weight: hasWeight
							? {
									material: weightMaterial.trim() || undefined,
									color: weightColor.trim() || undefined
								}
							: undefined,
						plates: plateList.length > 0 ? plateList : undefined
					}
				: undefined,
			pcb: hasPcb
				? {
						thickness,
						firmware: firmware.trim() || undefined,
						assembly: assembly.trim() || undefined,
						connectivity: connectivity.trim() || undefined
					}
				: undefined,
			purchase: hasPurchase
				? {
						vendor: vendor.trim() || undefined,
						price,
						orderDate: orderDate.trim() ? new Date(orderDate.trim()) : undefined,
						deliveryDate: deliveryDate.trim() ? new Date(deliveryDate.trim()) : undefined,
						orderStatus: orderStatus.trim() || undefined
					}
				: undefined,
			notes: notes.trim() || undefined,
			visibility
		};

		onSubmit(
			input,
			stagedImages.length > 0 ? stagedImages.map((staged) => staged.file) : undefined
		);
	}
</script>

<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit keyboard' : 'Add keyboard'}</h2>

	<div class="flex flex-col gap-2">
		<span class="field-label">Images</span>
		<div class="flex flex-wrap gap-3">
			{#if initial}
				{#each initial.images ?? [] as image (image.imageId)}
					<div class="relative">
						<img src={image.url} alt={initial.name} class="kc-thumb h-20 w-20 object-contain" />
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
							alt="Selected keyboard"
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
			<button type="button" class="btn" disabled={imageBusy} onclick={() => fileInput?.click()}>
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
			<span class="field-label">Size</span>
			<select class="field-select w-full" bind:value={size}>
				<option value="">—</option>
				{#each optionsWith(keyboardSizes, size) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Layout</span>
			<select class="field-select w-full" bind:value={layout}>
				<option value="">—</option>
				{#each optionsWith(availableLayouts, layout) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>
	</div>

	<details class="field-group" bind:open={designOpen}>
		<summary>
			Design
			<span class="field-group-hint">— {designSummary}</span>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-3">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Top case material</span>
				<select class="field-select w-full" bind:value={topCaseMaterial}>
					<option value="">—</option>
					{#each optionsWith(caseMaterials, topCaseMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Top case color</span>
				<input type="text" class="field-input" bind:value={topCaseColor} autocomplete="off" />
			</label>
			<div class="hidden sm:block"></div>

			<label class="flex flex-col gap-1.5">
				<span class="field-label">Bottom case material</span>
				<select class="field-select w-full" bind:value={bottomCaseMaterial}>
					<option value="">—</option>
					{#each optionsWith(caseMaterials, bottomCaseMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Bottom case color</span>
				<input type="text" class="field-input" bind:value={bottomCaseColor} autocomplete="off" />
			</label>
			<div class="hidden sm:block"></div>

			<label class="flex flex-col gap-1.5">
				<span class="field-label">Weight material</span>
				<select class="field-select w-full" bind:value={weightMaterial}>
					<option value="">—</option>
					{#each optionsWith(weightMaterials, weightMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Weight color</span>
				<input type="text" class="field-input" bind:value={weightColor} autocomplete="off" />
			</label>
			<div class="hidden sm:block"></div>

			<div class="flex flex-col gap-1.5 sm:col-span-3">
				<span class="field-label">Plates</span>
				<div class="flex flex-wrap gap-x-4 gap-y-2">
					{#each optionsWith(plateMaterials, [...plates]) as value (value)}
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								class="field-checkbox"
								checked={plates.has(value)}
								onchange={(event) => {
									if (event.currentTarget.checked) plates.add(value);
									else plates.delete(value);
								}}
							/>
							{value}
						</label>
					{/each}
				</div>
			</div>
		</div>
	</details>

	<details class="field-group" bind:open={pcbOpen}>
		<summary>
			PCB
			<span class="field-group-hint">— {pcbSummary}</span>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Thickness (mm)</span>
				<input type="number" class="field-input" min="0" step="0.1" bind:value={thickness} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Firmware</span>
				<select class="field-select w-full" bind:value={firmware}>
					<option value="">—</option>
					{#each optionsWith(firmwares, firmware) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Assembly</span>
				<select class="field-select w-full" bind:value={assembly}>
					<option value="">—</option>
					{#each optionsWith(assemblies, assembly) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Connectivity</span>
				<select class="field-select w-full" bind:value={connectivity}>
					<option value="">—</option>
					{#each optionsWith(connectivities, connectivity) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
		</div>
	</details>

	<details class="field-group" bind:open={purchaseOpen}>
		<summary>
			Purchase
			<span class="field-group-hint">— {purchaseSummary}</span>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Vendor</span>
				<select class="field-select w-full" bind:value={vendor}>
					<option value="">—</option>
					{#each optionsWith(vendors, vendor) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Order status</span>
				<select class="field-select w-full" bind:value={orderStatus}>
					<option value="">—</option>
					{#each optionsWith(orderStatuses, orderStatus) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Price</span>
				<input type="number" class="field-input" min="0" step="0.01" bind:value={price} />
			</label>
			{#if showOrderDate}
				<label class="flex flex-col gap-1.5">
					<span class="field-label">Order date</span>
					<input type="date" class="field-input" bind:value={orderDate} />
				</label>
			{/if}
			{#if isDelivered}
				<label class="flex flex-col gap-1.5">
					<span class="field-label">Delivery date</span>
					<input type="date" class="field-input" bind:value={deliveryDate} />
				</label>
			{/if}
		</div>
	</details>

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
			{saving ? 'Saving…' : initial ? 'Save changes' : 'Add keyboard'}
		</button>
		<button type="button" class="btn" disabled={saving} onclick={onCancel}>Cancel</button>
	</div>
</form>
