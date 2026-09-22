import { expect, test } from 'bun:test'
import { Result } from 'better-result'
import { parse_otpauth_url } from '../otpauth_parse'

// Key Uri Spec recommends that both should be equal.
// But e.g. M365 has them different. We keep both for better UX.
test('keep different issuers from label and parameter', () => {
	const result = parse_otpauth_url(
		'otpauth://totp/Test+Und%2BFirma%3Atest%40firma.onmicrosoft.com?secret=frjlnxsknymgykjx&issuer=Microsoft',
	)

	expect(Result.unwrap(result)).toEqual({
		label: 'test@firma.onmicrosoft.com',
		secret: 'frjlnxsknymgykjx',
		issuer: 'Microsoft',
		issuer_second: 'Test Und+Firma',
	})
})

test('explains that Microsoft Authenticator phonefactor URLs cannot be imported', () => {
	const result = parse_otpauth_url(
		'phonefactor://activate_account?code=123456789&url=https%3A%2F%2Fexample.phonefactor.net%2Fpad%2F123',
	)

	expect(Result.isError(result)).toBe(true)
	if (Result.isError(result)) {
		expect(result.error.message).toContain('phonefactor://')
		expect(result.error.message).toContain('otpauth://totp/')
	}
})

test('returns an error for malformed URLs instead of throwing', () => {
	const result = parse_otpauth_url('not a URL')

	expect(Result.isError(result)).toBe(true)
})
