import { expect, test } from 'bun:test'
import type { OtpDisplayInfo } from 'shared/src/types'
import { otpMatchesSearch } from '../util/otp_search'

const otp: OtpDisplayInfo = {
	id: '1',
	issuer: 'Microsoft',
	issuer_second: 'Test Und+Firma',
	label: 'test@firma.onmicrosoft.com',
	period: 30,
	tags: [],
}

test('matches empty query', () => {
	expect(otpMatchesSearch(otp, '')).toBe(true)
})

test('matches case-insensitively by issuer', () => {
	expect(otpMatchesSearch(otp, 'MICRO')).toBe(true)
})

test('matches by secondary issuer', () => {
	expect(otpMatchesSearch(otp, 'firma')).toBe(true)
})

test('matches by label', () => {
	expect(otpMatchesSearch(otp, 'onmicrosoft')).toBe(true)
})

test('trims query before matching', () => {
	expect(otpMatchesSearch(otp, '  test und  ')).toBe(true)
})

test('returns false when query does not match', () => {
	expect(otpMatchesSearch(otp, 'github')).toBe(false)
})
