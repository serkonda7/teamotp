import { afterEach, describe, expect, test } from 'bun:test'
import { type AppConfig, getConfig, initConfig } from './config'
import { getSecretEncryptionKey, getSigningKey } from './keys'

const originalConfig: AppConfig = JSON.parse(JSON.stringify(getConfig()))

afterEach(() => {
	initConfig(originalConfig)
})

describe('key derivation', () => {
	test('getSigningKey is stable across calls', () => {
		expect(getSigningKey()).toBe(getSigningKey())
	})

	test('signing and encryption subkeys differ', () => {
		expect(getSigningKey()).not.toBe(getSecretEncryptionKey().toString('base64'))
	})

	test('bumping jwtKeyVersion rotates the signing key only', () => {
		const beforeSign = getSigningKey()
		const beforeEncrypt = getSecretEncryptionKey().toString('base64')

		initConfig({
			...originalConfig,
			auth: { ...originalConfig.auth, jwtKeyVersion: originalConfig.auth.jwtKeyVersion + 1 },
		})

		expect(getSigningKey()).not.toBe(beforeSign)
		// The two rotation cadences must stay decoupled: stored secrets need no re-encryption
		expect(getSecretEncryptionKey().toString('base64')).toBe(beforeEncrypt)
	})
})
