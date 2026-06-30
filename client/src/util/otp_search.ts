import type { OtpDisplayInfo } from 'shared/src/types'

function normalize(value: string): string {
	return value.trim().toLocaleLowerCase()
}

export function otpMatchesSearch(otp: OtpDisplayInfo, query: string): boolean {
	const normalizedQuery = normalize(query)
	if (normalizedQuery.length === 0) {
		return true
	}

	return [otp.issuer, otp.issuer_second, otp.label].some((field) =>
		normalize(field).includes(normalizedQuery),
	)
}
