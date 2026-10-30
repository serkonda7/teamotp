import { eq, lt } from 'drizzle-orm'
import type { Context } from 'hono'
import { getConfig } from './config'
import { getDb } from './db'
import type { JwtPayload } from './middleware/auth'
import { access_log, sessions, users } from './schema'
import { nowSeconds } from './util/time'

export type AuditAction =
	| 'code.reveal'
	| 'entry.create'
	| 'entry.update'
	| 'entry.archive'
	| 'tag.create'
	| 'tag.update'
	| 'tag.delete'
	| 'tag.assign'
	| 'tag.unassign'
	| 'login.success'
	| 'login.failure'

export function createAuditLog(params: {
	userId: string
	userEmail: string
	action: string
	entryId?: string | null
	createdAt?: number
}): void {
	try {
		getDb()
			.insert(access_log)
			.values({
				id: Bun.randomUUIDv7(),
				user_id: params.userId,
				user_email: params.userEmail,
				action: params.action,
				entry_id: params.entryId ?? null,
				created_at: params.createdAt ?? nowSeconds(),
			})
			.run()
	} catch {
		// Audit must never break the main request
	}
}

/**
 * Logs an authenticated action. Called explicitly from route handlers so
 * the audited action is obvious at the call site.
 *
 * Resolves `user_id` via the session record (most reliable) falling back to
 * a lookup by email. Never throws.
 */
export function logAccess(c: Context, action: AuditAction | string, entryId?: string): void {
	try {
		const payload = c.get('jwtPayload') as JwtPayload | undefined
		if (!payload) {
			return
		}
		const email = payload.sub ?? 'unknown'

		// Session first (survives email changes), then the email lookup
		const row = getDb()
			.select({ id: users.id })
			.from(sessions)
			.innerJoin(users, eq(sessions.user_id, users.id))
			.where(eq(sessions.id, payload.jti))
			.get()
		const userId =
			row?.id ?? getDb().select().from(users).where(eq(users.email, email)).get()?.id

		createAuditLog({ userId: userId ?? email, userEmail: email, action, entryId })
	} catch {
		// Audit must never break the main request
	}
}

/**
 * Logs login attempts (both success and failure). Unlike `logAccess`,
 * this does not require an authenticated context — it records the attempted
 * email address.
 */
export function logLoginAttempt(params: {
	email: string
	action: 'login.success' | 'login.failure'
	userId?: string | null
}): void {
	const email = params.email || 'unknown'
	const userId = params.userId || email || 'unknown'
	createAuditLog({ userId, userEmail: email, action: params.action })
}

/** Returns the cutoff timestamp; the config schema guarantees an integer retention >= 1. */
function getRetentionCutoffSeconds(now: number): number {
	return now - getConfig().audit.retentionDays * 86400
}

/**
 * Deletes `access_log` rows older than the configured retention.
 * Returns number of rows removed. Never throws.
 */
export function pruneExpiredAuditLogs(now = nowSeconds()): number {
	try {
		const cutoff = getRetentionCutoffSeconds(now)
		const deleted = getDb()
			.delete(access_log)
			.where(lt(access_log.created_at, cutoff))
			.returning({ id: access_log.id })
			.all()
		return deleted.length
	} catch {
		return 0
	}
}

export const AUDIT_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000
