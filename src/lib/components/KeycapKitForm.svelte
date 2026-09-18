<script lang="ts">
	import type { KeycapKit, KeycapKitInput } from '@rogueserenity/kbdb-api-client';
	import { lookupsApi } from '$lib/api/client';

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
		initial?: KeycapKit;
		saving: boolean;
		error: string | null;
		onSubmit: (input: KeycapKitInput, stagedImage?: File) => void;
		onCancel: () => void;
		onImageUpload?: (file: File) => Promise<void>;
		onImageRemove?: () => Promise<void>;
		dirty?: boolean;
	} = $props();

	let name = $state(initial?.name ?? '');
	let vendor = $state(initial?.purchase?.vendor ?? '');
	let price = $state<number | undefined>(initial?.purchase?.price);
	let orderDate = $state(toDateInput(initial?.purchase?.orderDate));
	let deliveryDate = $state(toDateInput(initial?.purchase?.deliveryDate));
	let orderStatus = $state(initial?.purchase?.orderStatus ?? '');
	let primary = $state(initial?.primary ?? false);

	let showOrderDate = $derived(
		orderStatus.trim() !== '' && orderStatus.trim().toLowerCase() !== 'planned'
	);
	let isDelivered = $derived(orderStatus.trim().toLowerCase() === 'delivered');

	$effect(() => {
		if (!showOrderDate) orderDate = '';
	});
	$effect(() => {
		if (!isDelivered) deliveryDate = '';
		else if (!deliveryDate) deliveryDate = toDateInput(new Date());
	});

	function toDateInput(date: Date | undefined): string {
		return date ? date.toISOString().slice(0, 10) : '';
	}

	let vendors = $state<string[]>([]);
	let orderStatuses = $state<string[]>([]);

	// Closed sets validated server-side against the matching lookup. The
	// current value is always included even before the lookup loads (or if
	// it's since been retired from the list), so editing never silently
	// clears a value the kit already has.
	function optionsWith(loaded: string[], current: string): string[] {
		return current && !loaded.includes(current) ? [current, ...loaded] : loaded;
	}

	$effect(() => {
		Promise.all([
			lookupsApi.getLookup({ category: 'vendor' }),
			lookupsApi.getLookup({ category: 'order_status' })
		])
			.then(([vendorLookup, statusLookup]) => {
				vendors = vendorLookup.values;
				orderStatuses = statusLookup.values;
			})
			.catch(() => {
				// Open-vocabulary suggestions are a nice-to-have; the fields
				// still work as free text if lookups fail to load.
			});
	});

	let imageBusy = $state(false);
	let imageError = $state<string | null>(null);
	let fileInput = $state<HTMLInputElement | null>(null);

	// On create there's no kitId yet to attach an image to, so the file is
	// staged locally (with an object URL preview) and handed to onSubmit
	// alongside the form data — the parent uploads it once the kit exists.
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

	// Drives the "discard changes?" prompt on an accidental close (see
	// Modal's `dirty` prop) -- true once anything meaningfully differs from
	// the snapshot the form opened with.
	const initialName = initial?.name ?? '';
	const initialVendor = initial?.purchase?.vendor ?? '';
	const initialPrice = initial?.purchase?.price;
	const initialOrderDate = toDateInput(initial?.purchase?.orderDate);
	const initialDeliveryDate = toDateInput(initial?.purchase?.deliveryDate);
	const initialOrderStatus = initial?.purchase?.orderStatus ?? '';
	const initialPrimary = initial?.primary ?? false;

	$effect(() => {
		dirty =
			name !== initialName ||
			vendor !== initialVendor ||
			price !== initialPrice ||
			orderDate !== initialOrderDate ||
			deliveryDate !== initialDeliveryDate ||
			orderStatus !== initialOrderStatus ||
			primary !== initialPrimary ||
			stagedImage != null;
	});

	let validationError = $state<string | null>(null);

	// Pressing Enter in a single-line field (number/date/text) submits the
	// whole form by default -- surprising mid-way through a long form like
	// this one, where Enter more often means "confirm this field" than
	// "save everything." Textareas and buttons are left alone.
	function guardEnterSubmit(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		const target = event.target as HTMLElement;
		if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return;
		event.preventDefault();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		validationError = null;

		if (!name.trim()) {
			validationError = 'Name is required.';
			return;
		}

		const hasPurchase =
			vendor.trim() ||
			price != null ||
			orderDate.trim() ||
			deliveryDate.trim() ||
			orderStatus.trim();

		const input: KeycapKitInput = {
			name: name.trim(),
			purchase: hasPurchase
				? {
						vendor: vendor.trim() || undefined,
						price,
						orderDate: orderDate.trim() ? new Date(orderDate.trim()) : undefined,
						deliveryDate: deliveryDate.trim() ? new Date(deliveryDate.trim()) : undefined,
						orderStatus: orderStatus.trim() || undefined
					}
				: undefined,
			// Omitted (rather than sent as false) when this kit isn't already
			// primary and the checkbox wasn't touched, so an untouched kit
			// never clears another kit's primary designation on save.
			primary: primary || (initial?.primary ? false : undefined)
		};

		onSubmit(input, stagedImage ?? undefined);
	}
</script>

<!-- keydown here only guards against Enter submitting the form early -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<form class="flex flex-col gap-5" onsubmit={handleSubmit} onkeydown={guardEnterSubmit}>
	<h2 class="heading-lg text-2xl">{initial ? 'Edit kit' : 'Add kit'}</h2>

	<div class="flex items-center gap-4">
		{#if initial?.image?.url}
			<img
				src={initial.image.url}
				alt={initial.name}
				class="kc-thumb h-20 w-20 shrink-0 object-contain"
				decoding="async"
			/>
		{:else if stagedImagePreview}
			<img
				src={stagedImagePreview}
				alt="Selected kit"
				class="kc-thumb h-20 w-20 shrink-0 object-contain"
				decoding="async"
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

	<label class="flex flex-col gap-1.5">
		<span class="field-label">Name <span style="color: var(--danger)">*</span></span>
		<input
			type="text"
			class="field-input"
			placeholder="e.g. Base, Extension, Accents"
			bind:value={name}
			autocomplete="off"
			data-autofocus
		/>
	</label>

	<label class="flex items-center gap-2 text-sm">
		<input type="checkbox" class="field-checkbox" bind:checked={primary} />
		Primary kit for this set
	</label>

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

	{#if validationError}
		<p class="text-sm" style="color: var(--danger)">{validationError}</p>
	{/if}
	{#if error}
		<p class="text-sm" style="color: var(--danger)">{error}</p>
	{/if}

	<div class="mt-2 flex gap-2">
		<button type="submit" class="btn btn-accent" disabled={saving}>
			{saving ? 'Saving…' : initial ? 'Save changes' : 'Add kit'}
		</button>
		<button type="button" class="btn" disabled={saving} onclick={onCancel}>Cancel</button>
	</div>
</form>
