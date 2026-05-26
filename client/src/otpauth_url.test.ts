import { describe, expect, test } from 'bun:test'
import { Result } from 'better-result'
import { parseOtpauthUrl } from './otpauth_url'

describe('parseOtpauthUrl', () => {
	test('preserves both issuers when the path label issuer differs from the issuer parameter', () => {
		const result = parseOtpauthUrl(
			'otpauth://totp/Test+Und%2BFirma%3Atest%40firma.onmicrosoft.com?secret=frjlnxsknymgykjx&issuer=Microsoft',
		)

		expect(Result.unwrap(result)).toEqual({
			label: 'test@firma.onmicrosoft.com',
			secret: 'frjlnxsknymgykjx',
			issuer: 'Microsoft',
			issuer_second: 'Test Und+Firma',
		})
	})
})
