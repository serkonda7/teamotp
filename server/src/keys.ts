import { getConfig } from './config'

/** Centralizes signing-key access so later key derivation changes have one seam. */
export function getSigningKey(): string {
	return getConfig().auth.jwtSecret
}
