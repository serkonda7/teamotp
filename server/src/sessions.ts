import { sign } from 'hono/jwt'
import type { CookieOptions } from 'hono/utils/cookie'
import { config } from './config'
import { JWT_ALGO, type JwtPayload } from './middleware/auth'

export const SESSION_COOKIE_OPTS: CookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'Strict',
	path: '/',
	maxAge: 60 * 60 * 24 * 7,
}

/** Tracks valid ative sessions. */
const activeSessionIds = new Set<string>()

/**
 * Creates new active session ID.
 */
export function createSessionId(): string {
	const sid = crypto.randomUUID()
	activeSessionIds.add(sid)
	return sid
}

/** Checks if session ID is in allowlist. */
export function isValidSession(sid: string): boolean {
	return activeSessionIds.has(sid)
}

/** Removes session ID from the allowlist, effectively logging out the session. */
export function invalidateSession(sid: string): void {
	activeSessionIds.delete(sid)
}

/** Creates and signes a new session JWT. */
export async function get_signed_jwt(email: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	const sid = createSessionId()
	const exp = now + 60 * 60 * 24 * 7 // 1 week

	const payload: JwtPayload = {
		sub: email,
		jti: sid,
		iat: now,
		exp,
	}

	return await sign(payload, config.auth.jwtSecret, JWT_ALGO)
}
