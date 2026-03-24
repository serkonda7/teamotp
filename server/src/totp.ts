/**
 * Stub TOTP generator.
 * Replace this implementation with a real TOTP library, e.g.:
 *   import * as OTPAuth from 'otpauth'
 */
export function generateTotp(_secret: string): string {
	// TODO: implement real TOTP generation (RFC 6238)
	const stub = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
	return stub
}

/** Seconds remaining in the current 30-second TOTP window */
export function secondsRemaining(): number {
	return 30 - (Math.floor(Date.now() / 1000) % 30)
}
