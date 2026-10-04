export const authState = $state<{ user: { id: string; email: string | null } | null }>({
	user: null
});
