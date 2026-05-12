import * as OTPAuth from 'otpauth'
import type { OtpEntry } from './types'

export function generateTotpCode(entry: OtpEntry, timestamp = Date.now()): string {
	return new OTPAuth.TOTP({
		secret: entry.secret,
		algorithm: entry.algorithm,
		digits: entry.digits,
		period: entry.period,
	}).generate({ timestamp })
}
