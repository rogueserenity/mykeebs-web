<script lang="ts">
	import type { Switch as SwitchModel, SwitchInput } from '@rogueserenity/kbdb-api-client';
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
		initial?: SwitchModel;
		saving: boolean;
		error: string | null;
		onSubmit: (input: SwitchInput, stagedImage?: File) => void;
		onCancel: () => void;
		onImageUpload?: (file: File) => Promise<void>;
		onImageRemove?: () => Promise<void>;
	} = $props();

	let brand = $state(initial?.brand ?? '');
	let manufacturer = $state(initial?.manufacturer ?? '');
	let name = $state(initial?.name ?? '');
	let type = $state(initial?.type ?? '');
	let pins = $state(initial?.pins != null ? String(initial.pins) : '');
	let factoryLubed = $state(initial?.factoryLubed ?? false);
	let topHousing = $state(initial?.material?.topHousing ?? '');
	let bottomHousing = $state(initial?.material?.bottomHousing ?? '');
	let stem = $state(initial?.material?.stem ?? '');
	let actuation = $state<number | undefined>(initial?.force?.actuation);
	let bottomOut = $state<number | undefined>(initial?.force?.bottomOut);
	let springMaterial = $state(initial?.spring?.material ?? '');
	let preTravel = $state<number | undefined>(initial?.spring?.preTravel);
	let totalTravel = $state<number | undefined>(initial?.spring?.totalTravel);
	let vendor = $state(initial?.purchase?.vendor ?? '');
	let price = $state<number | undefined>(initial?.purchase?.price);
	let orderDate = $state(toDateInput(initial?.purchase?.orderDate));
	let deliveryDate = $state(toDateInput(initial?.purchase?.deliveryDate));
	let orderStatus = $state(initial?.purchase?.orderStatus ?? '');
	let quantity = $state<number | undefined>(initial?.purchase?.quantity);
	let notes = $state(initial?.notes ?? '');
	let visibility = $state<Visibility>(initial?.visibility ?? Visibility.Private);

	let isDelivered = $derived(orderStatus.trim().toLowerCase() === 'delivered');

	$effect(() => {
		if (!isDelivered) deliveryDate = '';
	});

	// Seeded once from initial data and never bound again — each <details>
	// then owns its own open/closed state via the browser's native toggle,
	// so typing into a field inside it (which changes the summary text
	// below) can't force it to snap shut mid-edit.
	let constructionOpen = $state(
		Boolean(
			initial?.material?.topHousing || initial?.material?.bottomHousing || initial?.material?.stem
		)
	);
	let feelOpen = $state(
		Boolean(
			initial?.force?.actuation != null ||
			initial?.force?.bottomOut != null ||
			initial?.spring?.material ||
			initial?.spring?.preTravel != null ||
			initial?.spring?.totalTravel != null
		)
	);
	let purchaseOpen = $state(Boolean(initial?.purchase));

	let constructionSummary = $derived(
		[topHousing, bottomHousing, stem].filter((v) => v.trim()).join(' · ') || 'Not set'
	);
	let feelSummary = $derived(
		[actuation != null ? `${actuation}g actuation` : undefined, springMaterial.trim() || undefined]
			.filter(Boolean)
			.join(' · ') || 'Not set'
	);
	let purchaseSummary = $derived(
		[vendor.trim() || undefined, orderStatus.trim() || undefined].filter(Boolean).join(' · ') ||
			'Not set'
	);

	function toDateInput(date: Date | undefined): string {
		return date ? date.toISOString().slice(0, 10) : '';
	}

	function toNumber(value: string): number | undefined {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		const n = Number(trimmed);
		return Number.isNaN(n) ? undefined : n;
	}

	let switchTypes = $state<string[]>([]);
	let switchMaterials = $state<string[]>([]);
	let springMaterials = $state<string[]>([]);
	let vendors = $state<string[]>([]);
	let orderStatuses = $state<string[]>([]);

	// Closed sets validated server-side against the matching lookup. The
	// current value is always included even before the lookup loads (or if
	// it's since been retired from the list), so editing never silently
	// clears a value the switch already has.
	function optionsWith(loaded: string[], current: string): string[] {
		return current && !loaded.includes(current) ? [current, ...loaded] : loaded;
	}

	$effect(() => {
		Promise.all([
			lookupsApi.getLookup({ category: 'switch_type' }),
			lookupsApi.getLookup({ category: 'switch_material' }),
			lookupsApi.getLookup({ category: 'switch_spring_material' }),
			lookupsApi.getLookup({ category: 'vendor' }),
			lookupsApi.getLookup({ category: 'order_status' })
		])
			.then(([type, material, spring, vendor, status]) => {
				switchTypes = type.values;
				switchMaterials = material.values;
				springMaterials = spring.values;
				vendors = vendor.values;
				orderStatuses = status.values;
			})
			.catch(() => {
				// Open-vocabulary suggestions are a nice-to-have; the fields
				// still work as free text if lookups fail to load.
			});
	});

	let imageBusy = $state(false);
	let imageError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	// On create there's no switchId yet to attach an image to, so the file
	// is staged locally (with an object URL preview) and handed to onSubmit
	// alongside the form data — the parent uploads it once the switch exists.
	let stagedImage = $state<File | null>(null);
	let stagedImagePreview = $state<string | null>(null);

	$effect(() => {
		return () => {
			if (stagedImagePreview) URL.revokeObjectURL(stagedImagePreview);
		};
	});

	function onImagePick(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;

		if (!initial) {
			if (stagedImagePreview) URL.revokeObjectURL(stagedImagePreview);
			stagedImage = file;
			stagedImagePreview = URL.createObjectURL(file);
			if (fileInput) fileInput.value = '';
			return;
		}

		uploadImage(file);
	}

	async function uploadImage(file: File) {
		if (!onImageUpload) return;
		imageError = null;
		imageBusy = true;
		try {
			await onImageUpload(file);
		} catch {
			imageError = 'Could not upload that image.';
		} finally {
			imageBusy = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function clearStagedImage() {
		if (stagedImagePreview) URL.revokeObjectURL(stagedImagePreview);
		stagedImage = null;
		stagedImagePreview = null;
	}

	async function removeImage() {
		if (!onImageRemove) return;
		imageError = null;
		imageBusy = true;
		try {
			await onImageRemove();
		} catch {
			imageError = 'Could not remove the image.';
		} finally {
			imageBusy = false;
		}
	}

	let validationError = $state<string | null>(null);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = null;

		if (!brand.trim() || !name.trim() || !type.trim()) {
			validationError = 'Brand, name, and type are required.';
			return;
		}

		const hasMaterial = topHousing.trim() || bottomHousing.trim() || stem.trim();
		const hasForce = actuation != null || bottomOut != null;
		const hasSpring = springMaterial.trim() || preTravel != null || totalTravel != null;
		const hasPurchase =
			vendor.trim() ||
			price != null ||
			orderDate.trim() ||
			deliveryDate.trim() ||
			orderStatus.trim() ||
			quantity != null;

		const input: SwitchInput = {
			brand: brand.trim(),
			manufacturer: manufacturer.trim() || undefined,
			name: name.trim(),
			type: type.trim(),
			pins: toNumber(pins),
			factoryLubed: factoryLubed || undefined,
			material: hasMaterial
				? {
						topHousing: topHousing.trim() || undefined,
						bottomHousing: bottomHousing.trim() || undefined,
						stem: stem.trim() || undefined
					}
				: undefined,
			force: hasForce
				? {
						actuation,
						bottomOut
					}
				: undefined,
			spring: hasSpring
				? {
						material: springMaterial.trim() || undefined,
						preTravel,
						totalTravel
					}
				: undefined,
			purchase: hasPurchase
				? {
						vendor: vendor.trim() || undefined,
						price,
						orderDate: orderDate.trim() ? new Date(orderDate.trim()) : undefined,
						deliveryDate: deliveryDate.trim() ? new Date(deliveryDate.trim()) : undefined,
						orderStatus: orderStatus.trim() || undefined,
						quantity
					}
				: undefined,
			notes: notes.trim() || undefined,
			visibility
		};

		onSubmit(input, stagedImage ?? undefined);
	}
</script>

<form class="flex flex-col gap-5" onsubmit={handleSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit switch' : 'Add switch'}</h2>

	<div class="flex items-center gap-4">
		{#if initial?.image?.url}
			<img
				src={initial.image.url}
				alt={initial.name}
				class="kc-thumb h-20 w-20 shrink-0 object-contain"
			/>
		{:else if stagedImagePreview}
			<img
				src={stagedImagePreview}
				alt="Selected switch"
				class="kc-thumb h-20 w-20 shrink-0 object-contain"
			/>
		{/if}
		<div class="flex flex-col gap-2">
			<div class="flex gap-2">
				<button type="button" class="btn" disabled={imageBusy} onclick={() => fileInput?.click()}>
					{imageBusy
						? 'Working…'
						: initial?.image?.url || stagedImage
							? 'Change photo'
							: 'Add photo'}
				</button>
				{#if initial?.image?.url}
					<button type="button" class="btn" disabled={imageBusy} onclick={removeImage}>
						Remove
					</button>
				{:else if stagedImage}
					<button type="button" class="btn" onclick={clearStagedImage}> Remove </button>
				{/if}
			</div>
			{#if imageError}
				<span class="text-xs" style="color: var(--danger)">{imageError}</span>
			{/if}
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/*"
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
			<span class="field-label">Type <span style="color: var(--danger)">*</span></span>
			<select class="field-select w-full" bind:value={type}>
				<option value="" disabled>Select a type…</option>
				{#each optionsWith(switchTypes, type) as value (value)}
					<option {value}>{value}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Manufacturer</span>
			<input type="text" class="field-input" bind:value={manufacturer} autocomplete="off" />
		</label>

		<label class="flex flex-col gap-1.5">
			<span class="field-label">Pins</span>
			<div class="flex items-center gap-3">
				<select class="field-select w-24 shrink-0" bind:value={pins}>
					<option value="">—</option>
					<option value="3">3-pin</option>
					<option value="5">5-pin</option>
				</select>
				<span class="flex items-center gap-2 whitespace-nowrap">
					<input type="checkbox" class="field-checkbox" bind:checked={factoryLubed} />
					<span class="text-sm">Factory lubed</span>
				</span>
			</div>
		</label>
	</div>

	<details class="field-group" bind:open={constructionOpen}>
		<summary>
			Construction
			<span class="field-group-hint">— {constructionSummary}</span>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-3">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Top housing</span>
				<select class="field-select w-full" bind:value={topHousing}>
					<option value="">—</option>
					{#each optionsWith(switchMaterials, topHousing) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Bottom housing</span>
				<select class="field-select w-full" bind:value={bottomHousing}>
					<option value="">—</option>
					{#each optionsWith(switchMaterials, bottomHousing) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Stem</span>
				<select class="field-select w-full" bind:value={stem}>
					<option value="">—</option>
					{#each optionsWith(switchMaterials, stem) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
		</div>
	</details>

	<details class="field-group" bind:open={feelOpen}>
		<summary>
			Feel
			<span class="field-group-hint">— {feelSummary}</span>
		</summary>
		<div class="field-group-body grid grid-cols-1 gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Actuation force (g)</span>
				<input type="number" class="field-input" min="0" step="0.1" bind:value={actuation} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Bottom-out force (g)</span>
				<input type="number" class="field-input" min="0" step="0.1" bind:value={bottomOut} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Spring material</span>
				<select class="field-select w-full" bind:value={springMaterial}>
					<option value="">—</option>
					{#each optionsWith(springMaterials, springMaterial) as value (value)}
						<option {value}>{value}</option>
					{/each}
				</select>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Pre-travel (mm)</span>
				<input type="number" class="field-input" min="0" step="0.01" bind:value={preTravel} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Total travel (mm)</span>
				<input type="number" class="field-input" min="0" step="0.01" bind:value={totalTravel} />
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
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Quantity</span>
				<input type="number" class="field-input" min="0" step="1" bind:value={quantity} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Order date</span>
				<input type="date" class="field-input" bind:value={orderDate} />
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="field-label">Delivery date</span>
				{#if isDelivered}
					<input type="date" class="field-input" bind:value={deliveryDate} />
				{:else}
					<span
						class="field-input text-faint flex items-center text-xs"
						style="cursor: not-allowed"
					>
						Set order status to "delivered" first
					</span>
				{/if}
			</label>
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
			{saving ? 'Saving…' : initial ? 'Save changes' : 'Add switch'}
		</button>
		<button type="button" class="btn" disabled={saving} onclick={onCancel}>Cancel</button>
	</div>
</form>
