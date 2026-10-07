<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { Keyboard, KeyboardInput } from '@rogueserenity/kbdb-api-client';
	import { Visibility } from '@rogueserenity/kbdb-api-client';
	import VisibilityPicker from './VisibilityPicker.svelte';
	import { lookupsApi } from '$lib/api/client';
	import { X } from '@lucide/svelte';
	import { toDateInput, todayDateInput } from '$lib/format';
	import { limitNotice, MAX_IMAGES, takeWithinLimit } from '$lib/image-limit';

	let {
		initial,
		saving,
		error,
		onSubmit,
		onCancel,
		onImageUpload,
		onImageRemove,
		dirty = $bindable(false)
	}: {
		initial?: Keyboard;
		saving: boolean;
		error: string | null;
		onSubmit: (input: KeyboardInput, stagedImages?: File[]) => void;
		onCancel: () => void;
		onImageUpload?: (file: File) => Promise<void>;
		onImageRemove?: (imageId: string) => Promise<void>;
		dirty?: boolean;
	} = $props();

	// Read once: a form keeps its in-progress edits when `initial` refreshes.
	const seed = untrack(() => initial);

	let brand = $state(seed?.brand ?? '');
	let name = $state(seed?.name ?? '');
	let size = $state(seed?.size ?? '');
	let layout = $state(seed?.layout ?? '');
	let topCaseMaterial = $state(seed?.design?.topCase?.material ?? '');
	let topCaseColor = $state(seed?.design?.topCase?.color ?? '');
	let bottomCaseMaterial = $state(seed?.design?.bottomCase?.material ?? '');
	let bottomCaseColor = $state(seed?.design?.bottomCase?.color ?? '');
	let weightMaterial = $state(seed?.design?.weight?.material ?? '');
	let weightColor = $state(seed?.design?.weight?.color ?? '');
	let plates = new SvelteSet<string>(seed?.design?.plates ?? []);
	let thickness = $state<number | undefined>(seed?.pcb?.thickness);
	let firmware = $state(seed?.pcb?.firmware ?? '');
	let assembly = $state(seed?.pcb?.assembly ?? '');
	let connectivity = $state(seed?.pcb?.connectivity ?? '');
	let vendor = $state(seed?.purchase?.vendor ?? '');
	let price = $state<number | undefined>(seed?.purchase?.price);
	let orderDate = $state(toDateInput(seed?.purchase?.orderDate));
	let deliveryDate = $state(toDateInput(seed?.purchase?.deliveryDate));
	let orderStatus = $state(seed?.purchase?.orderStatus ?? '');
	let notes = $state(seed?.notes ?? '');
	let visibility = $state<Visibility>(seed?.visibility ?? Visibility.Private);

	let showOrderDate = $derived(
		orderStatus.trim() !== '' && orderStatus.trim().toLowerCase() !== 'planned'
	);
	let isDelivered = $derived(orderStatus.trim().toLowerCase() === 'delivered');

	// Only clears in response to a status change, never on mount: an existing
	// item may legitimately carry dates its current status wouldn't set.
	let lastOrderStatus = seed?.purchase?.orderStatus ?? '';
	$effect(() => {
		if (orderStatus === lastOrderStatus) return;
		lastOrderStatus = orderStatus;
		if (!showOrderDate) orderDate = '';
		else if (!orderDate) orderDate = todayDateInput();
		if (!isDelivered) deliveryDate = '';
		else if (!deliveryDate) deliveryDate = todayDateInput();
	});

	let designOpen = $state(Boolean(seed?.design));
	let pcbOpen = $state(Boolean(seed?.pcb));
	let purchaseOpen = $state(Boolean(seed?.purchase));

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

	let availableLayouts = $derived(
		size
			? allLayouts.filter((l) => l.sizes.includes(size)).map((l) => l.name)
			: allLayouts.map((l) => l.name)
	);

	$effect(() => {
		if (allLayouts.length === 0) return;
		if (size && layout && !availableLayouts.includes(layout)) layout = '';
	});

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
			// Lookups only populate suggestions; the fields work without them.
			.catch(() => {});
	});

	let imageBusy = $state(false);
	let imageError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	type StagedImage = { file: File; preview: string };
	let stagedImages = $state<StagedImage[]>([]);
	const imageCount = $derived(initial ? (initial.images?.length ?? 0) : stagedImages.length);
	const atImageLimit = $derived(imageCount >= MAX_IMAGES);

	$effect(() => {
		return () => {
			for (const staged of stagedImages) URL.revokeObjectURL(staged.preview);
		};
	});

	function onImagePick(event: Event) {
		const picked = Array.from((event.target as HTMLInputElement).files ?? []);
		if (picked.length === 0) return;
		const { accepted: files, skipped } = takeWithinLimit(picked, imageCount);
		const notice = skipped > 0 ? limitNotice(skipped) : null;

		if (!initial) {
			stagedImages = [
				...stagedImages,
				...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))
			];
			imageError = notice;
			if (fileInput) fileInput.value = '';
			return;
		}

		uploadImages(files, notice);
	}

	async function uploadImages(files: File[], notice: string | null) {
		if (!onImageUpload) return;
		imageError = null;
		imageBusy = true;
		try {
			for (const file of files) await onImageUpload(file);
			imageError = notice;
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
		} catch {
			imageError = 'Could not remove the image.';
		} finally {
			imageBusy = false;
		}
	}

	const initialBrand = seed?.brand ?? '';
	const initialName = seed?.name ?? '';
	const initialSize = seed?.size ?? '';
	const initialLayout = seed?.layout ?? '';
	const initialTopCaseMaterial = seed?.design?.topCase?.material ?? '';
	const initialTopCaseColor = seed?.design?.topCase?.color ?? '';
	const initialBottomCaseMaterial = seed?.design?.bottomCase?.material ?? '';
	const initialBottomCaseColor = seed?.design?.bottomCase?.color ?? '';
	const initialWeightMaterial = seed?.design?.weight?.material ?? '';
	const initialWeightColor = seed?.design?.weight?.color ?? '';
	const initialPlates = [...(seed?.design?.plates ?? [])].sort();
	const initialThickness = seed?.pcb?.thickness;
	const initialFirmware = seed?.pcb?.firmware ?? '';
	const initialAssembly = seed?.pcb?.assembly ?? '';
	const initialConnectivity = seed?.pcb?.connectivity ?? '';
	const initialVendor = seed?.purchase?.vendor ?? '';
	const initialPrice = seed?.purchase?.price;
	const initialOrderDate = toDateInput(seed?.purchase?.orderDate);
	const initialDeliveryDate = toDateInput(seed?.purchase?.deliveryDate);
	const initialOrderStatus = seed?.purchase?.orderStatus ?? '';
	const initialNotes = seed?.notes ?? '';
	const initialVisibility = seed?.visibility ?? Visibility.Private;

	$effect(() => {
		dirty =
			brand !== initialBrand ||
			name !== initialName ||
			size !== initialSize ||
			layout !== initialLayout ||
			topCaseMaterial !== initialTopCaseMaterial ||
			topCaseColor !== initialTopCaseColor ||
			bottomCaseMaterial !== initialBottomCaseMaterial ||
			bottomCaseColor !== initialBottomCaseColor ||
			weightMaterial !== initialWeightMaterial ||
			weightColor !== initialWeightColor ||
			JSON.stringify([...plates].sort()) !== JSON.stringify(initialPlates) ||
			thickness != initialThickness ||
			firmware !== initialFirmware ||
			assembly !== initialAssembly ||
			connectivity !== initialConnectivity ||
			vendor !== initialVendor ||
			price != initialPrice ||
			orderDate !== initialOrderDate ||
			deliveryDate !== initialDeliveryDate ||
			orderStatus !== initialOrderStatus ||
			notes !== initialNotes ||
			visibility !== initialVisibility ||
			stagedImages.length > 0;
	});

	let validationError = $state<string | null>(null);
	const uid = $props.id();
	const validationId = `validation-${uid}`;

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

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form class="flex flex-col gap-5" onsubmit={handleSubmit} onkeydown={guardEnterSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit keyboard' : 'Add keyboard'}</h2>

	<div class="flex flex-col gap-2">
		<span class="field-label">Images</span>
		<div class="flex flex-wrap gap-3">
			{#if initial}
				{#each initial.images ?? [] as image, index (image.imageId)}
					<div class="relative">
						<img
							src={image.url}
							alt={initial.name}
							class="kc-thumb h-20 w-20 object-contain"
							loading="lazy"
							decoding="async"
						/>
						<button
							type="button"
							class="btn-icon absolute -top-2 -right-2 h-6 w-6 text-xs"
							disabled={imageBusy}
							aria-label="Remove image {index + 1} of {initial.images?.length}"
							onclick={() => removeImage(image.imageId)}
						>
							<X class="h-3.5 w-3.5" />
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
							decoding="async"
						/>
						<button
							type="button"
							class="btn-icon absolute -top-2 -right-2 h-6 w-6 text-xs"
							aria-label="Remove image {index + 1} of {stagedImages.length}"
							onclick={() => removeStagedImage(index)}
						>
							<X class="h-3.5 w-3.5" />
						</button>
					</div>
				{/each}
			{/if}
			<button
				type="button"
				class="btn"
				disabled={imageBusy || atImageLimit}
				onclick={() => fileInput?.click()}
			>
				{imageBusy ? 'Working…' : '+ Add photo'}
			</button>
		</div>
		{#if atImageLimit}
			<span class="text-faint text-xs">Up to {MAX_IMAGES} photos. Remove one to add another.</span>
		{/if}
		{#if imageError}
			<span class="text-xs" role="alert" style="color: var(--danger)">{imageError}</span>
		{/if}
		<input
			name="images"
			bind:this={fileInput}
			type="file"
			accept="image/*"
			multiple
			class="hidden"
			onchange={onImagePick}
		/>
	</div>

	<fieldset class="flex flex-col items-start gap-1.5">
		<legend class="field-label mb-1.5">Visibility</legend>
		<VisibilityPicker bind:value={visibility} />
	</fieldset>

	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5">
			<span class="field-label"
				>Brand <span aria-hidden="true" style="color: var(--danger)">*</span></span
			>
			<input
				name="brand"
				type="text"
				class="field-input"
				bind:value={brand}
				aria-required="true"
				aria-invalid={validationError !== null && !brand.trim()}
				aria-describedby={validationError !== null && !brand.trim() ? validationId : undefined}
				autocomplete="off"
				data-autofocus
			/>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label"
				>Name <span aria-hidden="true" style="color: var(--danger)">*</span></span
			>
			<input
				name="name"
				type="text"
				class="field-input"
				bind:value={name}
				aria-required="true"
				aria-invalid={validationError !== null && !name.trim()}
				aria-describedby={validationError !== null && !name.trim() ? validationId : undefined}
				autocomplete="off"
			/>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Size</span>
			<select name="size" class="field-select w-full" bind:value={size}>
				<option value="">—</option>
				{#each optionsWith(keyboardSizes, size) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Layout</span>
			<select name="layout" class="field-select w-full" bind:value={layout}>
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
				<select name="topCaseMaterial" class="field-select w-full" bind:value={topCaseMaterial}>
					<option value="">—</option>
					{#each optionsWith(caseMaterials, topCaseMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Top case color</span>
				<input
					name="topCaseColor"
					type="text"
					class="field-input"
					bind:value={topCaseColor}
					autocomplete="off"
				/>
			</label>
			<div class="hidden sm:block"></div>

			<label class="flex flex-col gap-1.5">
				<span class="field-label">Bottom case material</span>
				<select
					name="bottomCaseMaterial"
					class="field-select w-full"
					bind:value={bottomCaseMaterial}
				>
					<option value="">—</option>
					{#each optionsWith(caseMaterials, bottomCaseMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Bottom case color</span>
				<input
					name="bottomCaseColor"
					type="text"
					class="field-input"
					bind:value={bottomCaseColor}
					autocomplete="off"
				/>
			</label>
			<div class="hidden sm:block"></div>

			<label class="flex flex-col gap-1.5">
				<span class="field-label">Weight material</span>
				<select name="weightMaterial" class="field-select w-full" bind:value={weightMaterial}>
					<option value="">—</option>
					{#each optionsWith(weightMaterials, weightMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Weight color</span>
				<input
					name="weightColor"
					type="text"
					class="field-input"
					bind:value={weightColor}
					autocomplete="off"
				/>
			</label>
			<div class="hidden sm:block"></div>

			<div class="flex flex-col gap-1.5 sm:col-span-3">
				<span class="field-label">Plates</span>
				<div class="flex flex-wrap gap-x-4 gap-y-2">
					{#each optionsWith(plateMaterials, [...plates]) as value (value)}
						<label class="flex items-center gap-2 text-sm">
							<input
								name="plates"
								{value}
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
				<input
					name="thickness"
					type="number"
					class="field-input"
					min="0"
					step="0.1"
					bind:value={thickness}
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Firmware</span>
				<select name="firmware" class="field-select w-full" bind:value={firmware}>
					<option value="">—</option>
					{#each optionsWith(firmwares, firmware) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Assembly</span>
				<select name="assembly" class="field-select w-full" bind:value={assembly}>
					<option value="">—</option>
					{#each optionsWith(assemblies, assembly) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Connectivity</span>
				<select name="connectivity" class="field-select w-full" bind:value={connectivity}>
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
				<select name="vendor" class="field-select w-full" bind:value={vendor}>
					<option value="">—</option>
					{#each optionsWith(vendors, vendor) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Order status</span>
				<select name="orderStatus" class="field-select w-full" bind:value={orderStatus}>
					<option value="">—</option>
					{#each optionsWith(orderStatuses, orderStatus) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Price</span>
				<input
					name="price"
					type="number"
					class="field-input"
					min="0"
					step="0.01"
					bind:value={price}
				/>
			</label>
			{#if showOrderDate}
				<label class="flex flex-col gap-1.5">
					<span class="field-label">Order date</span>
					<input name="orderDate" type="date" class="field-input" bind:value={orderDate} />
				</label>
			{/if}
			{#if isDelivered}
				<label class="flex flex-col gap-1.5">
					<span class="field-label">Delivery date</span>
					<input name="deliveryDate" type="date" class="field-input" bind:value={deliveryDate} />
				</label>
			{/if}
		</div>
	</details>

	<label class="flex flex-col gap-1.5">
		<span class="field-label">Notes</span>
		<textarea name="notes" class="field-input" rows="5" maxlength="1000" bind:value={notes}
		></textarea>
	</label>

	{#if validationError}
		<p id={validationId} class="text-sm" role="alert" style="color: var(--danger)">
			{validationError}
		</p>
	{/if}
	{#if error}
		<p class="text-sm" role="alert" style="color: var(--danger)">{error}</p>
	{/if}

	<div class="mt-2 flex gap-2">
		<button type="submit" class="btn btn-accent" disabled={saving}>
			{saving ? 'Saving…' : initial ? 'Save changes' : 'Add keyboard'}
		</button>
		<button type="button" class="btn" disabled={saving} onclick={onCancel}>Cancel</button>
	</div>
</form>
