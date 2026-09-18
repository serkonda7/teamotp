import { and, eq, gt } from 'drizzle-orm'
import { auth_states, users } from '../schema'
import type { User } from '../types'
import { normalize_email } from '../util/email'
import { getDb } from './connection'

export function getUserByEmail(email: string): User | null {
	const normalized = normalize_email(email)
	const row = getDb().select().from(users).where(eq(users.email, normalized)).get()
	return (row as User | null) ?? null
}

export function getUserByProviderId(providerId: string): User | null {
	const row = getDb().select().from(users).where(eq(users.provider_id, providerId)).get()
	return (row as User | null) ?? null
}

export function upsertMicrosoftUser(params: { providerId: string; email: string }): User {
	const normalizedEmail = normalize_email(params.email)
	if (!normalizedEmail) {
		throw new Error('Email cannot be empty')
	}

	// User exists
	const existing = getUserByProviderId(params.providerId)
	if (existing) {
		return existing
	}

	// Local user with mail exists. Link Microsoft provider to existing user
	const existingByEmail = getUserByEmail(normalizedEmail)
	if (existingByEmail) {
		getDb()
			.update(users)
			.set({ provider: 'microsoft', provider_id: params.providerId })
			.where(eq(users.id, existingByEmail.id))
			.run()

		const updated = getUserByProviderId(params.providerId)
		if (updated) {
			return updated
		}

		return {
			...existingByEmail,
			provider: 'microsoft',
			provider_id: params.providerId,
		}
	}

	// Create new user with Microsoft provider
	const id = Bun.randomUUIDv7()
	const user: User = {
		id,
		email: normalizedEmail,
		password_hash: null,
		provider: 'microsoft',
		provider_id: params.providerId,
	}
	getDb().insert(users).values(user).run()
	return user
}

// ---------------------------------------------------------------------------
// OAuth login states (previously touched directly from routes/auth.ts)
// ---------------------------------------------------------------------------

export function createAuthState(state: string, verifier: string, expiresAt: number): void {
	getDb().insert(auth_states).values({ state, verifier, expires_at: expiresAt }).run()
}

export interface ConsumedAuthState {
	verifier: string
}

/**
 * Atomically consumes an OAuth state: deletes the row only when it exists
 * and has not expired, returning its verifier. The delete-where-not-expired
 * + `returning` closes the double-redeem window on the Microsoft callback —
 * the second concurrent redeem finds no row.
 *
 * Returns `null` when the state is missing or expired. Expired rows are
 * removed as a side effect so failed callbacks do not accumulate.
 */
export function consumeAuthState(state: string, now: number): ConsumedAuthState | null {
	const consumed = getDb()
		.delete(auth_states)
		.where(and(eq(auth_states.state, state), gt(auth_states.expires_at, now)))
		.returning({ verifier: auth_states.verifier })
		.get()
	if (consumed) {
		return consumed
	}
	// Missing or expired: drop an expired leftover if present, then report miss.
	getDb().delete(auth_states).where(eq(auth_states.state, state)).run()
	return null
}
