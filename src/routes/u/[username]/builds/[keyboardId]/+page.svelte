<script lang="ts">
	import { pageTitle } from '$lib/page-title';
	import { SvelteSet } from 'svelte/reactivity';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type {
		Build,
		BuildInput,
		Keyboard,
		Switch as SwitchModel
	} from '@rogueserenity/kbdb-api-client';
	import { ResponseError } from '@rogueserenity/kbdb-api-client';
	import { buildsApi, keyboardsApi, switchesApi, keycapSetsApi } from '$lib/api/client';
	import {
		STALE_REFS_MESSAGE,
		staleBuildRefsFromError,
		type StaleBuildRefs
	} from '$lib/build-refs';
	import { formatDate, formatPrice, type PurchaseLike } from '$lib/format';
	import { perItemImageRefetcher, updateWhere, withFreshImageUrls } from '$lib/stale-images';
	import { newestFirst } from '$lib/build-groups';
	import { fetchAllPages } from '$lib/pagination';
	import { stepIndex } from '$lib/step-index';
	import { uploadImage } from '$lib/upload';
	import { primaryBuildImageUrl } from '$lib/build';
	import { getUserContext } from '$lib/user-context';
	import Modal from '$lib/components/Modal.svelte';
	import ImageViewer from '$lib/components/ImageViewer.svelte';
	import BuildDetails from '$lib/components/BuildDetails.svelte';
	import VisibilityBadge from '$lib/components/VisibilityBadge.svelte';
	import BuildForm from '$lib/components/BuildForm.svelte';
	import KeyboardDetails from '$lib/components/KeyboardDetails.svelte';
	import SwitchDetails from '$lib/components/SwitchDetails.svelte';
	import KeycapKitDetails from '$lib/components/KeycapKitDetails.svelte';

	const userContext = getUserContext();
	const showPrice = $derived(userContext.showPrice);

	const keyboardId = $derived(page.params.keyboardId ?? '');

	type ViewState =
		| { status: 'loading' }
		| { status: 'error'; message: string }
		| { status: 'ready'; keyboard: Keyboard | null; builds: Build[] };

	let view = $state<ViewState>({ status: 'loading' });

	const buildsHeading = $derived(
		view.status === 'ready' ? `${view.keyboard?.name ?? 'Deleted keyboard'} builds` : 'Builds'
	);

	const failedImages = new SvelteSet<string>();
	const refetchStaleImages = perItemImageRefetcher(
		(buildId) => buildsApi.getBuild({ userId: userContext.userId, buildId }),
		(fresh, buildId) => {
			if (view.status !== 'ready') return;
			view = {
				...view,
				builds: updateWhere(
					view.builds,
					(build) => build.id === buildId,
					(build) => withFreshImageUrls(build, fresh)
				)
			};
		}
	);

	let loadToken = 0;

	async function load(userId: string, kId: string) {
		const token = ++loadToken;
		view = { status: 'loading' };
		try {
			const [keyboard, builds] = await Promise.all([
				keyboardsApi.getKeyboard({ userId, keyboardId: kId }).catch(() => null),
				fetchAllPages((cursor) => buildsApi.listBuilds({ userId, keyboardId: kId, cursor }))
			]);
			if (token !== loadToken) return;
			builds.sort(newestFirst);
			view = { status: 'ready', keyboard, builds };
		} catch {
			if (token !== loadToken) return;
			view = { status: 'error', message: 'Could not load builds for this keyboard.' };
		}
	}

	$effect(() => {
		if (userContext.userId && keyboardId) load(userContext.userId, keyboardId);
	});

	type FormMode = { mode: 'edit'; build: Build } | { mode: 'closed' };

	let selectedBuild = $state<Build | null>(null);
	let detailError = $state<string | null>(null);
	let detailLoading = $state(false);
	let formMode = $state<FormMode>({ mode: 'closed' });
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let staleRefs = $state<StaleBuildRefs | null>(null);
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
		staleRefs = null;
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

	function openEdit(build: Build) {
		saveError = null;
		staleRefs = null;
		formDirty = false;
		formMode = { mode: 'edit', build };
	}

	async function handleUpdate(buildId: string, input: BuildInput) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const build = await buildsApi.updateBuild({ userId, buildId, buildInput: input });
			await load(userId, keyboardId);
			selectedBuild = build;
			formMode = { mode: 'closed' };
			formDirty = false;
		} catch (err) {
			staleRefs = await staleBuildRefsFromError(err, input);
			if (err instanceof ResponseError) {
				const body = await err.response.json().catch(() => null);
				console.error('updateBuild failed', err.response.status, body);
			} else {
				console.error('updateBuild failed', err);
			}
			saveError = staleRefs ? STALE_REFS_MESSAGE : 'Could not save your changes.';
		} finally {
			saving = false;
		}
	}

	async function refreshEditingBuild(buildId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		const build = await buildsApi.getBuild({ userId, buildId });
		await load(userId, keyboardId);
		selectedBuild = build;
		if (formMode.mode === 'edit') formMode = { mode: 'edit', build };
	}

	async function uploadBuildImage(buildId: string, file: File) {
		const userId = userContext.userId;
		if (!userId) return;

		await uploadImage(file, (imageUploadRequest) =>
			buildsApi.createBuildImage({ userId, buildId, imageUploadRequest })
		);
	}

	async function handleImageUpload(buildId: string, file: File) {
		await uploadBuildImage(buildId, file);
		await refreshEditingBuild(buildId);
	}

	async function handleImageRemove(buildId: string, imageId: string) {
		const userId = userContext.userId;
		if (!userId) return;
		await buildsApi.deleteBuildImage({ userId, buildId, imageId });
		galleryIndex = 0;
		await refreshEditingBuild(buildId);
	}

	async function deleteBuild(buildId: string) {
		const userId = userContext.userId;
		if (!userId) return;

		deleting = true;
		deleteError = null;
		try {
			await buildsApi.deleteBuild({ userId, buildId });
			await load(userId, keyboardId);
			closeModal();
		} catch {
			deleteError = 'Could not delete this build.';
		} finally {
			deleting = false;
		}
	}

	async function openKeyboardDetail(kId: string) {
		const userId = userContext.userId;
		if (!userId) return;

		keyboardDetailError = null;
		keyboardDetailLoading = true;
		keyboardDetail = null;
		try {
			keyboardDetail = await keyboardsApi.getKeyboard({ userId, keyboardId: kId });
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
			galleryViewerOpen
	);
</script>

<svelte:head><title>{pageTitle(buildsHeading, `@${userContext.username}`)}</title></svelte:head>

<div class="p-4">
	<a
		href={resolve('/u/[username]/builds', { username: userContext.username })}
		class="text-muted text-sm hover:underline"
	>
		&larr; All builds
	</a>
</div>

{#if view.status === 'loading'}
	<p class="text-muted p-16 text-center font-mono text-sm tracking-wide">Loading&hellip;</p>
{:else if view.status === 'error'}
	<p class="p-16 text-center text-lg" style="color: var(--danger)">{view.message}</p>
{:else}
	{@const { keyboard, builds } = view}
	<div class="flex items-center gap-3 px-4">
		{#if keyboard?.images?.[0]?.url}
			<img
				src={keyboard.images[0].url}
				alt={keyboard.name}
				class="kc-thumb h-16 w-16 shrink-0 object-contain"
				decoding="async"
			/>
		{/if}
		<div>
			<h1 class="heading-lg text-2xl">{keyboard?.name ?? 'Deleted keyboard'}</h1>
			{#if keyboard?.brand}
				<p class="text-muted">{keyboard.brand}</p>
			{/if}
		</div>
	</div>

	{#if builds.length === 0}
		<p class="text-muted p-16 text-center text-xl font-semibold">No builds for this keyboard.</p>
	{:else}
		<ol class="kc-build-timeline mt-8 px-4">
			{#each builds as build, index (build.id)}
				{@const imageUrl = primaryBuildImageUrl(build)}
				<li class="kc-build-timeline-item">
					<button
						type="button"
						class="kc-build-timeline-dot"
						class:kc-build-timeline-dot-current={index === 0}
						aria-hidden="true"
						onclick={() => openBuild(build.id)}
					></button>
					<button
						type="button"
						class="kc-card flex w-full items-center gap-3 overflow-hidden p-3 text-left"
						onclick={() => openBuild(build.id)}
					>
						{#if imageUrl && !failedImages.has(imageUrl)}
							<img
								src={imageUrl}
								alt={keyboard?.name ?? 'Build'}
								class="kc-thumb h-20 w-20 shrink-0 object-contain"
								loading="lazy"
								decoding="async"
								onerror={() => {
									failedImages.add(imageUrl);
									refetchStaleImages(build.id);
								}}
							/>
						{/if}
						<div>
							<div class="flex flex-wrap items-center gap-2">
								<span class="heading-lg text-base">{formatDate(build.buildDate) ?? 'Undated'}</span>
								{#if index === 0}
									<span class="status-badge status-default">Current</span>
								{/if}
							</div>
							{#if showPrice && formatPrice(build.totalCost, build.currency)}
								<p class="text-faint font-mono text-xs">
									{formatPrice(build.totalCost, build.currency)}
								</p>
							{/if}
						</div>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
{/if}

<Modal
	open={detailLoading || detailError !== null || selectedBuild !== null}
	onClose={closeModal}
	wide
	obscured={anyNestedOpen && formMode.mode !== 'edit'}
	dirty={formDirty}
>
	{#snippet headerExtra()}
		{#if selectedBuild && formMode.mode !== 'edit'}
			<VisibilityBadge visibility={selectedBuild.visibility} />
		{/if}
	{/snippet}
	{#if detailLoading}
		<p class="text-muted p-8 text-center text-lg">Loading&hellip;</p>
	{:else if detailError}
		<p class="p-8 text-center text-lg" style="color: var(--danger)">{detailError}</p>
	{:else if formMode.mode === 'edit'}
		{@const build = formMode.build}
		<BuildForm
			initial={build}
			{saving}
			error={saveError}
			{staleRefs}
			onSubmit={(input) => handleUpdate(build.id, input)}
			onCancel={() => {
				formMode = { mode: 'closed' };
				formDirty = false;
			}}
			onImageUpload={(file) => handleImageUpload(build.id, file)}
			onImageRemove={(imageId) => handleImageRemove(build.id, imageId)}
			bind:dirty={formDirty}
		/>
	{:else if selectedBuild}
		{@const build = selectedBuild}
		<BuildDetails
			{build}
			onKeyboardClick={openKeyboardDetail}
			onSwitchClick={openSwitchDetail}
			onKeycapKitClick={openKitDetail}
			onImageClick={(index) => {
				galleryIndex = index;
				galleryViewerOpen = true;
			}}
			{showPrice}
		/>

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
		src={selectedBuild.images[Math.min(galleryIndex, selectedBuild.images.length - 1)].url}
		alt="Build"
		onClose={() => (galleryViewerOpen = false)}
		onPrev={selectedBuild.images.length > 1
			? () => (galleryIndex = stepIndex(galleryIndex, -1, selectedBuild!.images!.length))
			: undefined}
		onNext={selectedBuild.images.length > 1
			? () => (galleryIndex = stepIndex(galleryIndex, 1, selectedBuild!.images!.length))
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
			{showPrice}
		/>
	{/if}
</Modal>

{#if keyboardDetail?.images && keyboardDetail.images.length > 0}
	<ImageViewer
		open={keyboardGalleryViewerOpen}
		src={keyboardDetail.images[Math.min(keyboardGalleryIndex, keyboardDetail.images.length - 1)]
			.url}
		alt={keyboardDetail.name}
		onClose={() => (keyboardGalleryViewerOpen = false)}
		onPrev={keyboardDetail.images.length > 1
			? () =>
					(keyboardGalleryIndex = stepIndex(
						keyboardGalleryIndex,
						-1,
						keyboardDetail!.images!.length
					))
			: undefined}
		onNext={keyboardDetail.images.length > 1
			? () =>
					(keyboardGalleryIndex = stepIndex(
						keyboardGalleryIndex,
						1,
						keyboardDetail!.images!.length
					))
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
		<SwitchDetails sw={switchDetail} onImageClick={() => (switchViewerOpen = true)} {showPrice} />
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
			{showPrice}
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
