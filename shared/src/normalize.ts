/**
 * Case-insensitive comparison key: trim + lowercase.
 *
 * Single implementation for client search filtering (`otp_search.ts`) and
 * server tag uniqueness (`createTag`/`getTagByName`), which previously each
 * wrapped the same expression inline.
 *
 * Standardizes on `toLowerCase()` (not `toLocaleLowerCase()`, whose
 * locale-dependent mappings — e.g. Turkish dotted I — would make the same
 * query match differently per browser).
 */
export function normalize_key(value: string): string {
	return value.trim().toLowerCase()
}
