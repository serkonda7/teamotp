import { describe, expect, test } from 'bun:test'
import { generateTotpCode } from './otp'
import type { OtpEntry } from './types'

describe('generateTotpCode', () => {
	test('generates a code for a 10-byte secret', () => {
		const entry: OtpEntry = {
			id: 'otp_1',
			label: 'M365 account',
			issuer: 'Microsoft',
			secret: 'JBSWY3DPEHPK3PXP',
			algorithm: 'SHA1',
			digits: 6,
			period: 30,
		}

		expect(generateTotpCode(entry, 0)).toBe('282760')
	})
})
