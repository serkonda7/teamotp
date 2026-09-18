/**
 * Shared search normalization: trim + lowercase.
 *
 * Standardizes on `toLowerCase()` (not `toLocaleLowerCase()`, whose
 * locale-dependent mappings — e.g. Turkish dotted I — would make the same
 * query match differently per browser). Server tag lookup lower-cases the
 * same way via `normalize_tag_name()`, so client filtering and server
 * uniqueness agree.
 */
export function normalize_search(value: string): string {
	return value.trim().toLowerCase()
}
