import { Result, type Result as ResultType } from 'better-result'
import type { NewOtpEntry } from 'shared/src/types'

export function parseOtpauthUrl(raw: string): ResultType<NewOtpEntry, Error> {
	const url = new URL(raw)

	if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp') {
		return Result.err(new Error('URL must start with otpauth://totp/...'))
	}

	const url_path = url.pathname.replace(/\+/g, ' ')
	const full_label_path = decodeURIComponent(url_path).replace(/^\//, '')

	const [issuer_from_label, label] = full_label_path.includes(':')
		? full_label_path.split(':', 2)
		: ['', full_label_path]

	const secret = url.searchParams.get('secret')
	if (!secret) {
		return Result.err(new Error('Missing required parameter: secret'))
	}

	const issuer = url.searchParams.get('issuer') ?? issuer_from_label

	const entry: NewOtpEntry = {
		label,
		secret,
		issuer,
		issuer_second: issuer_from_label === issuer ? '' : issuer_from_label,
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
