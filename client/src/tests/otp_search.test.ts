import { expect, test } from 'bun:test'
import type { OtpDisplayInfo } from 'shared/src/types'
import { otpMatchesSearch, otpMatchesTags } from '../util/otp_search'

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

const taggedOtp: OtpDisplayInfo = {
	...otp,
	tags: [
		{ id: 'tag-1', name: 'Arbeit', color: '#3b82f6' },
		{ id: 'tag-2', name: 'Wichtig', color: '#ef4444' },
	],
}

test('tag filter matches everything when no tags are selected', () => {
	expect(otpMatchesTags(otp, [])).toBe(true)
})

test('tag filter matches when entry has all selected tags', () => {
	expect(otpMatchesTags(taggedOtp, ['tag-1'])).toBe(true)
	expect(otpMatchesTags(taggedOtp, ['tag-1', 'tag-2'])).toBe(true)
})

test('tag filter does not match when a selected tag is missing', () => {
	expect(otpMatchesTags(taggedOtp, ['tag-1', 'tag-3'])).toBe(false)
})

test('tag filter does not match entries without tags', () => {
	expect(otpMatchesTags(otp, ['tag-1'])).toBe(false)
})
