import { sign } from 'hono/jwt'
import type { CookieOptions } from 'hono/utils/cookie'
import { SESSION_ABSOLUTE_TIMEOUT_S, SESSION_IDLE_TIMEOUT_S } from 'shared/src/session'
import { getConfig } from './config'
import { JWT_ALGO, type JwtPayload } from './middleware/auth'

export const SESSION_COOKIE_OPTS: CookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'Strict',
	path: '/',
	maxAge: SESSION_ABSOLUTE_TIMEOUT_S,
}

/** Interval of the background sweep that drops timed out sessions. */
export const SESSION_SWEEP_INTERVAL_MS = 10 * 60 * 1000

type ActiveSession = {
	/** Unix seconds of the login, start of the absolute lifetime. */
	created_at: number
	/** Unix seconds of the last authenticated request, start of the idle window. */
	last_seen_at: number
}

/** Tracks valid ative sessions. */
const activeSessions = new Map<string, ActiveSession>()

function nowSeconds(): number {
	return Math.floor(Date.now() / 1000)
}

/** Checks both timeouts: idle since the last request, absolute since the login. */
function isExpired(session: ActiveSession, now: number): boolean {
	return (
		now - session.last_seen_at >= SESSION_IDLE_TIMEOUT_S ||
		now - session.created_at >= SESSION_ABSOLUTE_TIMEOUT_S
	)
}

/**
 * Creates new active session ID.
 */
export function createSessionId(): string {
	const sid = crypto.randomUUID()
	const now = nowSeconds()
	activeSessions.set(sid, { created_at: now, last_seen_at: now })
	return sid
}

/** Checks if session ID is in the allowlist and has not timed out. */
export function isValidSession(sid: string): boolean {
	const session = activeSessions.get(sid)
	if (!session) {
		return false
	}

	if (isExpired(session, nowSeconds())) {
		activeSessions.delete(sid)
		return false
	}

	return true
}

/**
 * Restarts the idle window of a session.
 * Called for every authenticated request, so an active user is never logged out.
 */
export function touchSession(sid: string): void {
	const session = activeSessions.get(sid)
	if (!session) {
		return
	}

	// Never revive an already timed out session, even if a caller skipped the check
	const now = nowSeconds()
	if (isExpired(session, now)) {
		activeSessions.delete(sid)
		return
	}

	session.last_seen_at = now
}

/** Removes session ID from the allowlist, effectively logging out the session. */
export function invalidateSession(sid: string): void {
	activeSessions.delete(sid)
}

/**
 * Drops all timed out sessions and returns how many were removed.
 * Without this the store only shrinks when an expired session is used again.
 */
export function sweepExpiredSessions(): number {
	const now = nowSeconds()
	let removed = 0

	for (const [sid, session] of activeSessions) {
		if (isExpired(session, now)) {
			activeSessions.delete(sid)
			removed++
		}
	}

	return removed
}

/** Creates and signes a new session JWT. */
export async function get_signed_jwt(email: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	const sid = createSessionId()
	const exp = now + SESSION_ABSOLUTE_TIMEOUT_S

	const payload: JwtPayload = {
		sub: email,
		jti: sid,
		iat: now,
		exp,
	}

	return await sign(payload, getConfig().auth.jwtSecret, JWT_ALGO)
}
