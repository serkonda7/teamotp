import { describe, expect, test } from 'bun:test'
import { Result } from 'better-result'
import { generateTotpCode } from './otp'
import type { OtpEntry } from './types'

describe('generateTotpCode', () => {
	test('generates a code for a 10-byte secret', () => {
		const entry: OtpEntry = {
			id: 'otp_1',
			label: 'M365 account',
			issuer: 'Microsoft',
			issuer_second: '',
			secret: 'JBSWY3DPEHPK3PXP',
			algorithm: 'sha1',
			digits: 6,
			period: 30,
		}

		expect(Result.unwrap(generateTotpCode(entry))).toHaveLength(6)
	})
})
