<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { BuildInput, BuildSummary } from '@rogueserenity/kbdb-api-client';
	import { resolve } from '$app/paths';
	import { buildsApi } from '$lib/api/client';
	import { formatDate, formatPrice } from '$lib/format';
	import { getUserContext } from '$lib/user-context';
	import CollectionGrid from '$lib/components/CollectionGrid.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import BuildForm from '$lib/components/BuildForm.svelte';

	const userContext = getUserContext();
	const currency = $derived(userContext.profile.preferences?.currency ?? 'USD');
	const showPrice = $derived(
		userContext.isOwnProfile
			? (userContext.profile.preferences?.showPriceToMe ?? true)
			: (userContext.profile.preferences?.showPriceToOthers ?? false)
	);

	// "Current" is the most recent buildDate; the API has no persisted
	// current-build concept.
	type KeyboardBuildGroup = {
		keyboardId: string;
		current: BuildSummary;
		buildCount: number;
	};

	function groupByKeyboard(builds: BuildSummary[]): KeyboardBuildGroup[] {
		const groups: Record<string, BuildSummary[]> = {};
		for (const build of builds) {
			const keyboardId = build.keyboardId;
			if (!keyboardId) continue;
			(groups[keyboardId] ??= []).push(build);
		}

		return Object.entries(groups).flatMap(([keyboardId, groupBuilds]) => {
			const sorted = [...groupBuilds].sort(
				(a, b) => (b.buildDate?.getTime() ?? 0) - (a.buildDate?.getTime() ?? 0)
			);
			const current = sorted[0];
			return current ? [{ keyboardId, current, buildCount: sorted.length }] : [];
		});
	}

	async function fetchGroupedBuilds(userId: string, cursor: string | undefined) {
		// Grouping needs every build up front, so the full paginated set is
		// fetched here and handed back as one synthetic page.
		if (cursor) return { items: [], nextCursor: undefined };

		const allBuilds: BuildSummary[] = [];
		let nextCursor: string | undefined;
		do {
			const page = await buildsApi.listBuilds({ userId, cursor: nextCursor });
			allBuilds.push(...(page.items ?? []));
			nextCursor = page.nextCursor ?? undefined;
		} while (nextCursor);

		return { items: groupByKeyboard(allBuilds), nextCursor: undefined };
	}

	type FormMode = { mode: 'create' } | { mode: 'closed' };

	let failedImages = new SvelteSet<string>();
	let formMode = $state<FormMode>({ mode: 'closed' });
	let grid = $state<ReturnType<typeof CollectionGrid<KeyboardBuildGroup>> | null>(null);
	let saving = $state(false);
	let saveError = $state<string | null>(null);
	let formDirty = $state(false);

	function closeModal() {
		formMode = { mode: 'closed' };
		saveError = null;
		formDirty = false;
	}

	function openCreate() {
		saveError = null;
		formDirty = false;
		formMode = { mode: 'create' };
	}

	async function handleCreate(input: BuildInput, stagedImages?: File[]) {
		const userId = userContext.userId;
		if (!userId) return;

		saving = true;
		saveError = null;
		try {
			const build = await buildsApi.createBuild({ userId, buildInput: input });
			if (stagedImages && stagedImages.length > 0) {
				// The build already exists, so an upload failure isn't a failed
				// create and saveError no longer applies to it.
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
</script>

<CollectionGrid
	bind:this={grid}
	userId={userContext.userId}
	fetchPage={fetchGroupedBuilds}
	itemKey={(group) => group.keyboardId}
	emptyMessage="No builds yet."
	getName={(group) => group.current.keyboard?.name}
	onAdd={userContext.isOwnProfile ? openCreate : undefined}
	addLabel="Add build"
	sortOptions={[
		{ label: 'Name', getValue: (group) => group.current.keyboard?.name },
		{ label: 'Build Date', getValue: (group) => group.current.buildDate?.getTime() },
		{ label: 'Total cost', getValue: (group) => group.current.totalCost ?? undefined }
	]}
>
	{#snippet card(group)}
		{@const build = group.current}
		{@const imageFailed = build.id != null && failedImages.has(build.id)}
		<a
			href={resolve('/u/[username]/builds/[keyboardId]', {
				username: userContext.username,
				keyboardId: group.keyboardId
			})}
			class="kc-card flex w-full items-center gap-3 overflow-hidden p-3 text-left"
		>
			{#if build.image?.url && !imageFailed}
				<img
					src={build.image.url}
					alt={build.keyboard?.name ?? 'Build'}
					class="kc-thumb h-24 w-24 shrink-0 object-contain"
					loading="lazy"
					decoding="async"
					onerror={() => build.id && failedImages.add(build.id)}
				/>
			{/if}
			<div class="pr-4">
				<h2 class="heading-lg text-lg">{build.keyboard?.name ?? 'Unknown keyboard'}</h2>
				<p class="text-muted text-sm">{build.keyboard?.brand}</p>
				{#if formatDate(build.buildDate) || (showPrice && formatPrice(build.totalCost, currency))}
					<p class="text-faint font-mono text-xs">
						{[
							formatDate(build.buildDate),
							showPrice ? formatPrice(build.totalCost, currency) : undefined
						]
							.filter(Boolean)
							.join(' · ')}
					</p>
				{/if}
				{#if group.buildCount > 1}
					<p class="text-faint mt-1 text-xs">{group.buildCount} builds</p>
				{/if}
			</div>
		</a>
	{/snippet}
</CollectionGrid>

<Modal open={formMode.mode === 'create'} onClose={closeModal} wide dirty={formDirty}>
	{#if formMode.mode === 'create'}
		<BuildForm
			{saving}
			error={saveError}
			onSubmit={handleCreate}
			onCancel={closeModal}
			bind:dirty={formDirty}
		/>
	{/if}
</Modal>
