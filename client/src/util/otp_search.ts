import type { OtpDisplayInfo } from 'shared/src/types'

function normalize(value: string): string {
	return value.trim().toLocaleLowerCase()
}

/** Matches when any of the fields contains the query (empty query matches everything). */
export function matchesQuery(fields: string[], query: string): boolean {
	const normalizedQuery = normalize(query)
	if (normalizedQuery.length === 0) {
		return true
	}

	return fields.some((field) => normalize(field).includes(normalizedQuery))
}

export function otpMatchesSearch(otp: OtpDisplayInfo, query: string): boolean {
	return matchesQuery([otp.issuer, otp.issuer_second, otp.label], query)
}

/** Matches when the entry has all of the given tag IDs (empty list matches everything). */
export function otpMatchesTags(otp: OtpDisplayInfo, tagIds: string[]): boolean {
	if (tagIds.length === 0) {
		return true
	}

	const entryTagIds = new Set(otp.tags.map((tag) => tag.id))
	return tagIds.every((id) => entryTagIds.has(id))
}
