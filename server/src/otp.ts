import { Result } from 'better-result'
import { createGuardrails, generateSync } from 'otplib'
import type { OtpEntry } from './types'

const compatibility_guardrails = createGuardrails({ MIN_SECRET_BYTES: 10 })

export function generateTotpCode(entry: OtpEntry): Result<string, Error> {
	try {
		const code = generateSync({
			strategy: 'totp',
			secret: entry.secret,
			algorithm: entry.algorithm,
			digits: entry.digits,
			period: entry.period,
			guardrails: compatibility_guardrails,
		})
		return Result.ok(code)
	} catch (e) {
		return Result.err(e instanceof Error ? e : new Error('Unknown error generating TOTP code'))
	}
}
