import { err, ok, type Result } from '@serkonda7/ts-result'
import * as OTPAuth from 'otpauth'
import type { OtpEntry } from './types'

export function generateTotpCode(entry: OtpEntry, timestamp = Date.now()): Result<string> {
	try {
		const code = new OTPAuth.TOTP({
			secret: entry.secret,
			algorithm: entry.algorithm,
			digits: entry.digits,
			period: entry.period,
		}).generate({ timestamp })
		return ok(code)
	} catch (e) {
		return err(e instanceof Error ? e : new Error('Unknown error generating TOTP code'))
	}
}
