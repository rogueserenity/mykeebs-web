import { getContext, setContext } from 'svelte';

// route/params rather than a pre-resolved href, so the root layout can call
// resolve() itself where svelte/no-navigation-without-resolve can see it --
// that lint rule can't trace a resolve() call across this context boundary.
export type ProfileSubNavItem = {
	route:
		| '/u/[username]'
		| '/u/[username]/keyboards'
		| '/u/[username]/switches'
		| '/u/[username]/keycap-sets'
		| '/u/[username]/builds';
	username: string;
	label: string;
};

// Lets a nested /u/[username] route register its own tab strip
// (Overview/Keyboards/...) with the root layout, so the root header's
// hamburger menu can fold those tabs in below the md breakpoint instead of
// only the app-wide nav links. The root layout creates and owns this state;
// the nested layout writes into it and clears it on destroy so navigating
// away from a profile page doesn't leave stale tabs in the menu.
export type ProfileSubNavContext = {
	items: ProfileSubNavItem[];
};

const KEY = Symbol('profile-subnav-context');

export function setProfileSubNavContext(context: ProfileSubNavContext): void {
	setContext(KEY, context);
}

export function getProfileSubNavContext(): ProfileSubNavContext | undefined {
	return getContext<ProfileSubNavContext | undefined>(KEY);
}
