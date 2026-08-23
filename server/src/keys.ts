import { hkdfSync } from 'node:crypto'
import { getConfig } from './config'

function derive(info: string, bytes: number): Buffer {
	const appKey = getConfig().auth.appKey
	return Buffer.from(hkdfSync('sha256', appKey, '', info, bytes))
}

/**
 * Bumping `auth.jwtKeyVersion` rotates the signing key alone — every session is
 * invalidated, but stored secrets stay untouched and need no re-encryption.
 */
export function getSigningKey(): string {
	const version = getConfig().auth.jwtKeyVersion
	return derive(`teamotp:jwt:v${version}`, 32).toString('base64')
}

/** Cryptographically independent subkey, consumed by Phase 7 secret encryption. */
export function getSecretEncryptionKey(): Buffer {
	return derive('teamotp:db-secret-enc', 32)
}
