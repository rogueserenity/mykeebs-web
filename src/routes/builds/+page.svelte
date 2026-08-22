<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { Build, Keyboard, Switch as SwitchModel } from '@rogueserenity/kbdb-api-client';
	import { auth } from '$lib/auth/auth.svelte';
	import { buildsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import { formatDate, formatPrice, type PurchaseLike } from '$lib/format';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import KeyboardDetails from '$lib/components/KeyboardDetails.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';
	import KeycapKitDetails from '$lib/components/KeycapKitDetails.svelte';

	let selectedBuild = $state<Build | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let failedImages = new SvelteSet<string>();

	let galleryViewerOpen = $state(false);
	let galleryIndex = $state(0);

	let keyboardDetail = $state<Keyboard | null>(null);
	let keyboardDetailError = $state<string | null>(null);
	let keyboardDetailLoading = $state(false);

	let switchDetail = $state<SwitchModel | null>(null);
	let switchDetailError = $state<string | null>(null);
	let switchDetailLoading = $state(false);

	let kitDetail = $state<{
		name: string;
		imageUrl: string | undefined;
		purchase: PurchaseLike | undefined;
	} | null>(null);
	let kitDetailError = $state<string | null>(null);
	let kitDetailLoading = $state(false);
	let kitViewerOpen = $state(false);

	async function openBuild(buildId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		detailError = null;
		detailLoading = true;
		selectedBuild = null;
		try {
			selectedBuild = await buildsApi.getBuild({ userId, buildId });
		} catch {
			detailError = 'Could not load this build.';
		} finally {
			detailLoading = false;
		}
	}

	function closeModal() {
		selectedBuild = null;
		detailError = null;
		detailLoading = false;
		galleryViewerOpen = false;
		galleryIndex = 0;
	}

	async function openKeyboardDetail(keyboardId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		keyboardDetailError = null;
		keyboardDetailLoading = true;
		keyboardDetail = null;
		try {
			keyboardDetail = await keyboardsApi.getKeyboard({ userId, keyboardId });
		} catch {
			keyboardDetailError = 'Could not load this keyboard.';
		} finally {
			keyboardDetailLoading = false;
		}
	}

	function closeKeyboardDetail() {
		keyboardDetail = null;
		keyboardDetailError = null;
		keyboardDetailLoading = false;
	}

	async function openSwitchDetail(switchId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		switchDetailError = null;
		switchDetailLoading = true;
		switchDetail = null;
		try {
			switchDetail = await switchesApi.getSwitch({ userId, switchId });
		} catch {
			switchDetailError = 'Could not load this switch.';
		} finally {
			switchDetailLoading = false;
		}
	}

	function closeSwitchDetail() {
		switchDetail = null;
		switchDetailError = null;
		switchDetailLoading = false;
	}

	async function openKitDetail(keycapSetId: string, kitId: string) {
		const userId = auth.user?.id;
		if (!userId) return;

		kitDetailError = null;
		kitDetailLoading = true;
		kitDetail = null;
		try {
			const set = await keycapSetsApi.getKeycapSet({ userId, keycapSetId });
			const kit = set.kits?.find((k) => k.kitId === kitId);
			if (!kit) {
				kitDetailError = 'This kit no longer exists.';
			} else {
				kitDetail = { name: kit.name, imageUrl: kit.image?.url, purchase: kit.purchase };
			}
		} catch {
			kitDetailError = 'Could not load this kit.';
		} finally {
			kitDetailLoading = false;
		}
	}

	function closeKitDetail() {
		kitDetail = null;
		kitDetailError = null;
		kitDetailLoading = false;
		kitViewerOpen = false;
	}

	const anyNestedOpen = $derived(
		keyboardDetailLoading ||
			keyboardDetailError !== null ||
			keyboardDetail !== null ||
			switchDetailLoading ||
			switchDetailError !== null ||
			switchDetail !== null ||
			kitDetailLoading ||
			kitDetailError !== null ||
			kitDetail !== null ||
			galleryViewerOpen
	);
</script>

<CollectionGrid
	fetchPage={(userId: string, cursor: string | undefined) =>
		buildsApi.listBuilds({ userId, cursor })}
	itemKey={(build) => build.id ?? ''}
	emptyMessage="No builds yet."
	getName={(build) => build.keyboard?.name}
	sortOptions={[
		{ label: 'Name', getValue: (build) => build.keyboard?.name },
		{ label: 'Build Date', getValue: (build) => build.buildDate?.getTime() }
	]}
>
	{#snippet card(build)}
		{@const imageFailed = build.id != null && failedImages.has(build.id)}
		<button
			type="button"
			class="w-full overflow-hidden card preset-tonal p-4 text-left"
			onclick={() => openBuild(build.id ?? '')}
		>
			{#if build.image?.url && !imageFailed}
				<img
					src={build.image.url}
					alt={build.keyboard?.name ?? 'Build'}
					class="mb-3 aspect-square w-full rounded bg-white object-contain"
					onerror={() => build.id && failedImages.add(build.id)}
				/>
			{/if}
			<h2 class="text-lg font-bold">{build.keyboard?.name ?? 'Unknown keyboard'}</h2>
			<p class="text-sm opacity-75">{build.keyboard?.brand}</p>
			{#if formatDate(build.buildDate)}
				<p class="text-sm">{formatDate(build.buildDate)}</p>
			{/if}
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={detailLoading || detailError !== null || selectedBuild !== null}
	onClose={closeModal}
	wide
	obscured={anyNestedOpen}
>
	{#if detailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg text-error-500">{detailError}</p>
	{:else if selectedBuild}
		{@const build = selectedBuild}
		<div class="pr-8">
			{#if build.keyboard}
				<button
					type="button"
					class="text-left"
					onclick={() => openKeyboardDetail(build.keyboard!.id)}
				>
					<h2 class="text-2xl font-bold hover:underline">{build.keyboard.name}</h2>
					<p class="opacity-75">{build.keyboard.brand}</p>
				</button>
			{:else}
				<h2 class="text-2xl font-bold opacity-50">Deleted keyboard</h2>
			{/if}
			{#if formatDate(build.buildDate) || formatPrice(build.totalCost)}
				<p class="mt-1 text-sm">
					{[formatDate(build.buildDate), formatPrice(build.totalCost)].filter(Boolean).join(' · ')}
				</p>
			{/if}
			{#if build.notes}
				<p class="mt-2 text-sm opacity-75">{build.notes}</p>
			{/if}
		</div>

		{#if build.images && build.images.length > 0}
			<div class="mt-6">
				<h3 class="font-semibold">Images</h3>
				<div class="mt-2 flex flex-wrap gap-3">
					{#each build.images as image, index (image.imageId)}
						<button
							type="button"
							class="h-20 w-20 shrink-0 overflow-hidden rounded bg-white"
							aria-label="View full size image"
							onclick={() => {
								galleryIndex = index;
								galleryViewerOpen = true;
							}}
						>
							<img src={image.url} alt="Build" class="h-full w-full object-contain" />
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
			{#if build.plate || build.caseMountType || build.stabs || build.foam != null}
				<div>
					<h3 class="font-semibold">Build details</h3>
					<dl class="mt-2 space-y-2 text-sm">
						{#if build.plate}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Plate</dt>
								<dd>{build.plate}</dd>
							</div>
						{/if}
						{#if build.caseMountType?.type}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Mount type</dt>
								<dd>
									{[build.caseMountType.type, build.caseMountType.durometer]
										.filter(Boolean)
										.join(' · ')}
								</dd>
							</div>
						{/if}
						{#if build.stabs?.name}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Stabs</dt>
								<dd>{[build.stabs.name, build.stabs.mountType].filter(Boolean).join(' · ')}</dd>
							</div>
						{/if}
						{#if build.foam != null}
							<div class="flex justify-between gap-4">
								<dt class="opacity-75">Foam</dt>
								<dd>{build.foam ? 'Yes' : 'No'}</dd>
							</div>
						{/if}
					</dl>
				</div>
			{/if}

			{#if build.switches && build.switches.length > 0}
				<div>
					<h3 class="font-semibold">Switches</h3>
					<ul class="mt-2 space-y-2 text-sm">
						{#each build.switches as entry, index (index)}
							<li>
								{#if entry._switch}
									<button
										type="button"
										class="text-left hover:underline"
										onclick={() => openSwitchDetail(entry._switch!.id)}
									>
										{entry.count}x {entry._switch.name} ({entry._switch.brand})
									</button>
								{:else}
									<span class="opacity-50">{entry.count}x Deleted switch</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if build.keycapKits && build.keycapKits.length > 0}
				{@const sortedKeycapKits = [...build.keycapKits].sort((a, b) =>
					(a.keycapSet?.name ?? '').localeCompare(b.keycapSet?.name ?? '')
				)}
				<div>
					<h3 class="font-semibold">Keycap kits</h3>
					<ul class="mt-2 space-y-2 text-sm">
						{#each sortedKeycapKits as entry, index (entry.keycapSet ? `${entry.keycapSet.id}-${entry.kitId}` : index)}
							<li>
								{#if entry.keycapSet && entry.kitName}
									<button
										type="button"
										class="text-left hover:underline"
										onclick={() => openKitDetail(entry.keycapSet!.id, entry.kitId)}
									>
										{entry.keycapSet.name} &mdash; {entry.kitName}
									</button>
								{:else}
									<span class="opacity-50">Deleted keycap kit</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>
	{/if}
</Modal>

{#if selectedBuild?.images && selectedBuild.images.length > 0}
	<ImageViewer
		open={galleryViewerOpen}
		src={selectedBuild.images[galleryIndex].url}
		alt="Build"
		onClose={() => (galleryViewerOpen = false)}
		onPrev={selectedBuild.images.length > 1
			? () =>
					(galleryIndex =
						(galleryIndex - 1 + selectedBuild!.images!.length) % selectedBuild!.images!.length)
			: undefined}
		onNext={selectedBuild.images.length > 1
			? () => (galleryIndex = (galleryIndex + 1) % selectedBuild!.images!.length)
			: undefined}
	/>
{/if}

<Modal
	open={keyboardDetailLoading || keyboardDetailError !== null || keyboardDetail !== null}
	onClose={closeKeyboardDetail}
>
	{#if keyboardDetailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if keyboardDetailError}
		<p class="p-8 text-center text-lg text-error-500">{keyboardDetailError}</p>
	{:else if keyboardDetail}
		<KeyboardDetails keyboard={keyboardDetail} />
	{/if}
</Modal>

<Modal
	open={switchDetailLoading || switchDetailError !== null || switchDetail !== null}
	onClose={closeSwitchDetail}
>
	{#if switchDetailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if switchDetailError}
		<p class="p-8 text-center text-lg text-error-500">{switchDetailError}</p>
	{:else if switchDetail}
		<SwitchDetails sw={switchDetail} />
	{/if}
</Modal>

<Modal
	open={kitDetailLoading || kitDetailError !== null || kitDetail !== null}
	onClose={closeKitDetail}
	obscured={kitViewerOpen}
>
	{#if kitDetailLoading}
		<p class="p-8 text-center text-lg opacity-75">Loading&hellip;</p>
	{:else if kitDetailError}
		<p class="p-8 text-center text-lg text-error-500">{kitDetailError}</p>
	{:else if kitDetail}
		{@const kit = kitDetail}
		<KeycapKitDetails
			name={kit.name}
			imageUrl={kit.imageUrl}
			imageFailed={false}
			onImageError={() => {}}
			onImageClick={() => (kitViewerOpen = true)}
			purchase={kit.purchase}
		/>
	{/if}
</Modal>

{#if kitDetail?.imageUrl}
	<ImageViewer
		open={kitViewerOpen}
		src={kitDetail.imageUrl}
		alt={kitDetail.name}
		onClose={() => (kitViewerOpen = false)}
	/>
{/if}
