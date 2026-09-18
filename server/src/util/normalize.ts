import { normalize_email } from './email'

export { normalize_email }

/**
 * Tag-name normalization for uniqueness checks: trim + lowercase.
 *
 * Display case is preserved in `tags.name`; this is only the comparison key
 * behind `tags.normalized_name` (unique index) and `getTagByName()`, so both
 * writers and readers must use it.
 */
export function normalize_tag_name(name: string): string {
	return name.trim().toLowerCase()
}
