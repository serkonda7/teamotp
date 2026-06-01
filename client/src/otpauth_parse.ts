import { Result } from 'better-result'
import type { NewOtpEntry } from 'shared/src/types'

/**
 * Extract relevant data from an `otpauth://TYPE/LABEL?PARAMETERS` URL.
 * See Key Uri Spec: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 */
export function parse_otpauth_url(raw: string): Result<NewOtpEntry, Error> {
	const url = new URL(raw)

	// Fail on invalid URLs or HOTP as we only support TOTP
	if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp') {
		return Result.err(new Error('URL must start with otpauth://totp/...'))
	}

	const url_path = url.pathname.replace(/\+/g, ' ')
	const full_label = decodeURIComponent(url_path).replace(/^\//, '')

	const [issuer_from_label, label] = full_label.includes(':')
		? full_label.split(':', 2)
		: ['', full_label]

	const secret = url.searchParams.get('secret')
	if (!secret) {
		return Result.err(new Error('Missing required parameter: secret'))
	}

	const issuer = url.searchParams.get('issuer') ?? issuer_from_label // Set issuer to param or fallback to label
	const issuer_secondary = issuer_from_label === issuer ? '' : issuer_from_label // Set secondary issuer if different

	const entry: NewOtpEntry = {
		label,
		secret,
		issuer,
		issuer_second: issuer_secondary,
	}

	const algorithm = url.searchParams.get('algorithm')
	if (algorithm) {
		entry.algorithm = algorithm.toUpperCase()
	}

	const digits = url.searchParams.get('digits')
	if (digits) {
		entry.digits = Number.parseInt(digits, 10)
	}

	const period = url.searchParams.get('period')
	if (period) {
		entry.period = Number.parseInt(period, 10)
	}

	// TODO client-side validation of fields

	return Result.ok(entry)
}
