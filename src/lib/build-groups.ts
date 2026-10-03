import type { Build } from '@rogueserenity/kbdb-api-client';

export type KeyboardBuildGroup = {
	keyboardId: string;
	current: Build;
	buildCount: number;
	mixedVisibility: boolean;
};

export function newestFirst(a: Build, b: Build): number {
	return (b.buildDate?.getTime() ?? 0) - (a.buildDate?.getTime() ?? 0);
}

export function groupByKeyboard(builds: Build[]): KeyboardBuildGroup[] {
	const groups = new Map<string, Build[]>();
	for (const build of builds) {
		const group = groups.get(build.keyboardId);
		if (group) group.push(build);
		else groups.set(build.keyboardId, [build]);
	}

	return [...groups].map(([keyboardId, groupBuilds]) => {
		const sorted = [...groupBuilds].sort(newestFirst);
		const current = sorted[0];
		return {
			keyboardId,
			current,
			buildCount: sorted.length,
			mixedVisibility: sorted.some((build) => build.visibility !== current.visibility)
		};
	});
}
