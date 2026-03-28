import { err, ok, type Result } from '@serkonda7/ts-result'
import type { NewOtpEntry } from '../../shared/src/types'

// TODO us result type
export function parseOtpauthUrl(raw: string): Result<NewOtpEntry, Error> {
	const url = new URL(raw)

	if (url.protocol !== 'otpauth:' || url.hostname.toLowerCase() !== 'totp') {
		return err(new Error('URL must start with otpauth://totp/...'))
	}

	const path_label = decodeURIComponent(url.pathname).replace(/^\//, '')

	const [issuerFromPath, labelFromPath] = path_label.includes(':')
		? path_label.split(':', 2)
		: ['', path_label]

	const secret = url.searchParams.get('secret')
	if (!secret) {
		return err(new Error('Missing required parameter: secret'))
	}

	const entry: NewOtpEntry = {
		label: labelFromPath,
		secret,
		issuer: url.searchParams.get('issuer') ?? issuerFromPath,
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

	return ok(entry)
}
