import { eq, lte, or } from 'drizzle-orm'
import { sign } from 'hono/jwt'
import type { CookieOptions } from 'hono/utils/cookie'
import { SESSION_ABSOLUTE_TIMEOUT_S, SESSION_IDLE_TIMEOUT_S } from 'shared/src/session'
import { getConfig } from './config'
import { db } from './db'
import { getSigningKey } from './keys'
import { JWT_ALGO, type JwtPayload } from './middleware/auth'
import { auth_states, sessions } from './schema'
import type { User } from './types'
import { nowSeconds } from './util/time'

export function getSessionCookieOpts(): CookieOptions {
	return {
		httpOnly: true,
		secure: getConfig().auth.secureCookies,
		sameSite: 'Strict',
		path: '/',
		maxAge: SESSION_ABSOLUTE_TIMEOUT_S,
	}
}

export const SESSION_SWEEP_INTERVAL_MS = 60 * 60 * 1000

export function createSession(userId: string): string {
	const id = crypto.randomUUID()
	const now = nowSeconds()
	db.insert(sessions)
		.values({
			id,
			user_id: userId,
			created_at: now,
			last_seen_at: now,
			expires_at: now + SESSION_ABSOLUTE_TIMEOUT_S,
		})
		.run()
	return id
}

export function isValidSession(sid: string): boolean {
	const session = db.select().from(sessions).where(eq(sessions.id, sid)).get()
	if (!session) {
		return false
	}

	const now = nowSeconds()
	if (session.expires_at <= now || session.last_seen_at + SESSION_IDLE_TIMEOUT_S <= now) {
		db.delete(sessions).where(eq(sessions.id, sid)).run()
		return false
	}
	return true
}

export function touchSession(sid: string): void {
	if (!isValidSession(sid)) {
		return
	}
	db.update(sessions).set({ last_seen_at: nowSeconds() }).where(eq(sessions.id, sid)).run()
}

export function invalidateSession(sid: string): void {
	db.delete(sessions).where(eq(sessions.id, sid)).run()
}

/** Removes expired sessions and PKCE states in one scheduled sweep. */
export function sweepExpired(): number {
	const now = nowSeconds()
	const expiredSessions = or(
		lte(sessions.expires_at, now),
		lte(sessions.last_seen_at, now - SESSION_IDLE_TIMEOUT_S),
	)
	const sessionsRemoved = db
		.delete(sessions)
		.where(expiredSessions)
		.returning({ id: sessions.id })
		.all().length
	const statesRemoved = db
		.delete(auth_states)
		.where(lte(auth_states.expires_at, now))
		.returning({ state: auth_states.state })
		.all().length
	return sessionsRemoved + statesRemoved
}

export async function get_signed_jwt(user: User): Promise<string> {
	const now = nowSeconds()
	const sid = createSession(user.id)
	const payload: JwtPayload = {
		sub: user.email,
		jti: sid,
		iat: now,
		exp: now + SESSION_ABSOLUTE_TIMEOUT_S,
	}
	return await sign(payload, getSigningKey(), JWT_ALGO)
}
