<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type {
		Build,
		BuildInput,
		Keyboard,
		Switch as SwitchModel
	} from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { buildsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import { formatDate, formatPrice, type PurchaseLike } from '$lib/format';
	import { getUserContext } from '$lib/user-context';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import KeyboardDetails from '$lib/components/KeyboardDetails.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';
	import KeycapKitDetails from '$lib/components/KeycapKitDetails.svelte';
	import BuildForm from '$lib/components/BuildForm.svelte';

	const userContext = getUserContext();

	// 'view' shows the existing build detail markup below; 'create'/'edit'
	// show BuildForm. Reloading the grid after a mutation calls
	// grid.refresh() directly rather than remounting CollectionGrid, so the
	// user's sort/search selections survive the reload.
	type FormMode = { mode: 'create' } | { mode: 'edit'; build: Build } | { mode: 'closed' };

	let selectedBuild = $state<Build | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let failedImages = new SvelteSet<string>();
	let formMode = $state<FormMode>({ mode: 'closed' });
	let grid = $state<ReturnType<typeof CollectionGrid<Build>> | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let deleting = $state(false);
	let deleteError = $state<string | null>(null);
	let confirmingDelete = $state(false);
	let formDirty = $state(false);

	let galleryViewerOpen = $state(false);
	let galleryIndex = $state(0);

	let keyboardDetail = $state<Keyboard | null>(null);
	let keyboardDetailError = $state<string | null>(null);
	let keyboardDetailLoading = $state(false);
	let keyboardGalleryViewerOpen = $state(false);
	let keyboardGalleryIndex = $state(0);

	let switchDetail = $state<SwitchModel | null>(null);
	let switchDetailError = $state<string | null>(null);
	let switchDetailLoading = $state(false);
	let switchViewerOpen = $state(false);

	let kitDetail = $state<{
		name: string;
		imageUrl: string | undefined;
		purchase: PurchaseLike | undefined;
	} | null>(null);
	let kitDetailError = $state<string | null>(null);
	let kitDetailLoading = $state(false);
	let kitViewerOpen = $state(false);

	async function openBuild(buildId: string) {
		const userId = userContext.userId;
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
		formMode = { mode: 'closed' };
		saveError = null;
		deleteError = null;
		confirmingDelete = false;
		formDirty = false;
	}

	function openCreate() {
		saveError = null;
		formDirty = false;
		formMode = { mode: 'create' };
	}

	function openEdit(build: Build) {
		saveError = null;
		formDirty = false;
		formMode = { mode: 'edit', build };
	}

	async function handleCreate(input: BuildInput, stagedImages?: File[]) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const build = await buildsApi.createBuild({ userId, buildInput: input });
			if (stagedImages && stagedImages.length > 0) {
				// The build itself was created successfully at this point; an
				// image-upload failure here shouldn't be reported as a failed
				// create, so it's swallowed rather than surfaced via saveError
				// (which the created build no longer applies to).
				await Promise.all(
					stagedImages.map((file) => uploadBuildImage(build.id, file).catch(() => {}))
				);
			}
			await grid?.refresh();
			closeModal();
		} catch {
			saveError = 'Could not create this build.';
		} finally {
			saving = false;
		}
	}

	async function handleUpdate(buildId: string, input: BuildInput) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const build = await buildsApi.updateBuild({ userId, buildId, buildInput: input });
			await grid?.refresh();
			selectedBuild = build;
			formMode = { mode: 'closed' };
			formDirty = false;
		} catch (err) {
			if (err instanceof ResponseError) {
				const body = await err.response.json().catch(() => null);
				console.error('updateBuild failed', err.response.status, body);
			} else {
				console.error('updateBuild failed', err);
			}
			saveError = 'Could not save your changes.';
		} finally {
			saving = false;
		}
	}

	async function refreshEditingBuild(buildId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		const build = await buildsApi.getBuild({ userId, buildId });
		await grid?.refresh();
		selectedBuild = build;
		if (formMode.mode === 'edit') formMode = { mode: 'edit', build };
	}

	async function uploadBuildImage(buildId: string, file: File) {
		const userId = userContext.userId;
		if (!userId) return;

		const { uploadUrl } = await buildsApi.createBuildImage({
			userId,
			buildId,
			imageUploadRequest: { contentType: file.type }
		});
		const put = await fetch(uploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': file.type },
			body: file
		});
		if (!put.ok) throw new Error(`upload failed: ${put.status}`);
	}

	async function handleImageUpload(buildId: string, file: File) {
		await uploadBuildImage(buildId, file);
		await refreshEditingBuild(buildId);
	}

	async function handleImageRemove(buildId: string, imageId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		await buildsApi.deleteBuildImage({ userId, buildId, imageId });
		await refreshEditingBuild(buildId);
	}

	async function deleteBuild(buildId: string) {
		const userId = userContext.userId;
		if (!userId) return;

		deleting = true;
		deleteError = null;
		try {
			await buildsApi.deleteBuild({ userId, buildId });
			await grid?.refresh();
			closeModal();
		} catch {
			deleteError = 'Could not delete this build.';
		} finally {
			deleting = false;
		}
	}

	async function openKeyboardDetail(keyboardId: string) {
		const userId = userContext.userId;
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
		keyboardGalleryViewerOpen = false;
		keyboardGalleryIndex = 0;
	}

	async function openSwitchDetail(switchId: string) {
		const userId = userContext.userId;
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
		switchViewerOpen = false;
	}

	async function openKitDetail(keycapSetId: string, kitId: string) {
		const userId = userContext.userId;
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
			galleryViewerOpen ||
			formMode.mode !== 'closed'
	);
</script>

{#if userContext.isOwnProfile}
	<div class="flex justify-end p-4 pb-0">
		<button type="button" class="btn btn-accent" onclick={openCreate}>+ Add build</button>
	</div>
{/if}

<CollectionGrid
	bind:this={grid}
	userId={userContext.userId}
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
			class="kc-card flex w-full items-center gap-3 overflow-hidden p-3 text-left"
			onclick={() => openBuild(build.id ?? '')}
		>
			{#if build.image?.url && !imageFailed}
				<img
					src={build.image.url}
					alt={build.keyboard?.name ?? 'Build'}
					class="kc-thumb h-24 w-24 shrink-0 object-contain"
					onerror={() => build.id && failedImages.add(build.id)}
				/>
			{/if}
			<div class="pr-4">
				<h2 class="heading-lg text-lg">{build.keyboard?.name ?? 'Unknown keyboard'}</h2>
				<p class="text-muted text-sm">{build.keyboard?.brand}</p>
				{#if formatDate(build.buildDate)}
					<p class="text-faint font-mono text-xs">{formatDate(build.buildDate)}</p>
				{/if}
			</div>
		</button>
	{/snippet}
</CollectionGrid>

<Modal
	open={detailLoading ||
		detailError !== null ||
		selectedBuild !== null ||
		formMode.mode === 'create'}
	onClose={closeModal}
	wide
	obscured={anyNestedOpen && formMode.mode !== 'create' && formMode.mode !== 'edit'}
	dirty={formDirty}
>
	{#if formMode.mode === 'create'}
		<BuildForm
			{saving}
			error={saveError}
			onSubmit={handleCreate}
			onCancel={closeModal}
			bind:dirty={formDirty}
		/>
	{:else if detailLoading}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{detailError}</p>
	{:else if formMode.mode === 'edit'}
		{@const build = formMode.build}
		<BuildForm
			initial={build}
			{saving}
			error={saveError}
			onSubmit={(input) => handleUpdate(build.id, input)}
			onCancel={() => (formMode = { mode: 'closed' })}
			onImageUpload={(file) => handleImageUpload(build.id, file)}
			onImageRemove={(imageId) => handleImageRemove(build.id, imageId)}
			bind:dirty={formDirty}
		/>
	{:else if selectedBuild}
		{@const build = selectedBuild}
		<div class="pr-8">
			{#if build.keyboard}
				<button
					type="button"
					class="flex items-center gap-3 text-left"
					onclick={() => openKeyboardDetail(build.keyboard!.id)}
				>
					{#if build.keyboard.imageUrl}
						<img
							src={build.keyboard.imageUrl}
							alt={build.keyboard.name}
							class="kc-thumb h-16 w-16 shrink-0 object-contain"
						/>
					{/if}
					<div>
						<h2 class="heading-lg text-2xl hover:underline">{build.keyboard.name}</h2>
						<p class="text-muted">{build.keyboard.brand}</p>
					</div>
				</button>
			{:else}
				<h2 class="heading-lg text-faint text-2xl">Deleted keyboard</h2>
			{/if}
			{#if formatDate(build.buildDate) || formatPrice(build.totalCost)}
				<p class="text-faint mt-1 font-mono text-sm">
					{[formatDate(build.buildDate), formatPrice(build.totalCost)].filter(Boolean).join(' · ')}
				</p>
			{/if}
			{#if build.notes}
				<p class="text-muted mt-2 text-sm">{build.notes}</p>
			{/if}
		</div>

		{#if build.images && build.images.length > 0}
			<div class="mt-6">
				<h3 class="section-label">Images</h3>
				<div class="flex flex-wrap gap-3">
					{#each build.images as image, index (image.imageId)}
						<button
							type="button"
							class="kc-thumb h-20 w-20 shrink-0 overflow-hidden"
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
					<h3 class="section-label">Build details</h3>
					<dl class="spec-list">
						{#if build.plate}
							<div class="spec-row">
								<dt>Plate</dt>
								<span class="spec-leader"></span>
								<dd>{build.plate}</dd>
							</div>
						{/if}
						{#if build.caseMountType?.type}
							<div class="spec-row">
								<dt>Mount type</dt>
								<span class="spec-leader"></span>
								<dd>
									{[build.caseMountType.type, build.caseMountType.durometer]
										.filter(Boolean)
										.join(' · ')}
								</dd>
							</div>
						{/if}
						{#if build.stabs?.name}
							<div class="spec-row">
								<dt>Stabs</dt>
								<span class="spec-leader"></span>
								<dd>{[build.stabs.name, build.stabs.mountType].filter(Boolean).join(' · ')}</dd>
							</div>
						{/if}
						{#if build.foam != null}
							<div class="spec-row">
								<dt>Foam</dt>
								<span class="spec-leader"></span>
								<dd>{build.foam ? 'Yes' : 'No'}</dd>
							</div>
						{/if}
					</dl>
				</div>
			{/if}

			{#if build.switches && build.switches.length > 0}
				<div>
					<h3 class="section-label">Switches</h3>
					<ul class="space-y-2 text-sm">
						{#each build.switches as entry, index (index)}
							<li>
								{#if entry._switch}
									<button
										type="button"
										class="flex items-center gap-2 text-left hover:underline"
										onclick={() => openSwitchDetail(entry._switch!.id)}
									>
										{#if entry._switch.imageUrl}
											<img
												src={entry._switch.imageUrl}
												alt={entry._switch.name}
												class="kc-thumb h-8 w-8 shrink-0 object-contain"
											/>
										{/if}
										<span class="font-mono"
											>{entry.count}x {entry._switch.name} ({entry._switch.brand})</span
										>
									</button>
								{:else}
									<span class="text-faint">{entry.count}x Deleted switch</span>
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
					<h3 class="section-label">Keycap kits</h3>
					<ul class="space-y-2 text-sm">
						{#each sortedKeycapKits as entry, index (entry.keycapSet ? `${entry.keycapSet.id}-${entry.kitId}` : index)}
							<li>
								{#if entry.keycapSet && entry.kitName}
									<button
										type="button"
										class="flex items-center gap-2 text-left hover:underline"
										onclick={() => openKitDetail(entry.keycapSet!.id, entry.kitId)}
									>
										{#if entry.kitImageUrl}
											<img
												src={entry.kitImageUrl}
												alt={entry.kitName}
												class="kc-thumb h-8 w-8 shrink-0 object-contain"
											/>
										{/if}
										<span class="font-mono">{entry.keycapSet.name} &mdash; {entry.kitName}</span>
									</button>
								{:else}
									<span class="text-faint">Deleted keycap kit</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		{#if userContext.isOwnProfile}
			<div
				class="mt-6 flex flex-wrap items-center gap-2 border-t pt-4"
				style="border-color: var(--border)"
			>
				<button type="button" class="btn" onclick={() => openEdit(build)}>Edit</button>
				{#if confirmingDelete}
					<span class="text-sm">Delete this build?</span>
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						disabled={deleting}
						onclick={() => deleteBuild(build.id)}
					>
						{deleting ? 'Deleting…' : 'Confirm delete'}
					</button>
					<button
						type="button"
						class="btn"
						disabled={deleting}
						onclick={() => (confirmingDelete = false)}
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						class="btn"
						style="color: var(--danger)"
						onclick={() => (confirmingDelete = true)}
					>
						Delete
					</button>
				{/if}
			</div>
			{#if deleteError}
				<p class="mt-2 text-sm" style="color: var(--danger)">{deleteError}</p>
			{/if}
		{/if}
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
	obscured={keyboardGalleryViewerOpen}
>
	{#if keyboardDetailLoading}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if keyboardDetailError}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{keyboardDetailError}</p>
	{:else if keyboardDetail}
		<KeyboardDetails
			keyboard={keyboardDetail}
			onImageClick={(index) => {
				keyboardGalleryIndex = index;
				keyboardGalleryViewerOpen = true;
			}}
		/>
	{/if}
</Modal>

{#if keyboardDetail?.images && keyboardDetail.images.length > 0}
	<ImageViewer
		open={keyboardGalleryViewerOpen}
		src={keyboardDetail.images[keyboardGalleryIndex].url}
		alt={keyboardDetail.name}
		onClose={() => (keyboardGalleryViewerOpen = false)}
		onPrev={keyboardDetail.images.length > 1
			? () =>
					(keyboardGalleryIndex =
						(keyboardGalleryIndex - 1 + keyboardDetail!.images!.length) %
						keyboardDetail!.images!.length)
			: undefined}
		onNext={keyboardDetail.images.length > 1
			? () => (keyboardGalleryIndex = (keyboardGalleryIndex + 1) % keyboardDetail!.images!.length)
			: undefined}
	/>
{/if}

<Modal
	open={switchDetailLoading || switchDetailError !== null || switchDetail !== null}
	onClose={closeSwitchDetail}
	obscured={switchViewerOpen}
>
	{#if switchDetailLoading}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if switchDetailError}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{switchDetailError}</p>
	{:else if switchDetail}
		<SwitchDetails sw={switchDetail} onImageClick={() => (switchViewerOpen = true)} />
	{/if}
</Modal>

{#if switchDetail?.image?.url}
	<ImageViewer
		open={switchViewerOpen}
		src={switchDetail.image.url}
		alt={switchDetail.name}
		onClose={() => (switchViewerOpen = false)}
	/>
{/if}

<Modal
	open={kitDetailLoading || kitDetailError !== null || kitDetail !== null}
	onClose={closeKitDetail}
	obscured={kitViewerOpen}
>
	{#if kitDetailLoading}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if kitDetailError}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{kitDetailError}</p>
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
