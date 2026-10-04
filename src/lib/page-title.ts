const SITE_NAME = 'mykeebs';

export function pageTitle(...parts: string[]): string {
	return [...parts.filter((part) => part.trim()), SITE_NAME].join(' · ');
}
