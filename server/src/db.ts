import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import type { HashAlgorithm } from 'otplib'
import type { NewOtpEntry, OtpDisplayInfo } from 'shared/src/types'
import { entries, users } from './schema'
import type { OtpEntry, UpdateOtpEntry, User } from './types'
import { SERVER_ROOT } from './util/server_root'

const data_dir = path.join(SERVER_ROOT, 'data')
// TODO enrypt entire DB

const is_test_run = Bun.env.NODE_ENV === 'test'

// Create or open the database file and run migrations
const migrations_folder = path.join(SERVER_ROOT, 'drizzle')
if (!fs.existsSync(path.join(migrations_folder, 'meta/_journal.json'))) {
	throw new Error(`Drizzle migrations not found at ${migrations_folder}.`)
}
const db_path = resolve_db_path()
console.log(`Using DB: ${db_path}`)
const sqlite = new Database(db_path, { create: true, strict: true })

export const db = drizzle(sqlite)
migrate(db, { migrationsFolder: migrations_folder })

// Precedence for DB path:
// 1. TEAMOTP_DB_PATH env var
// 2. if test: in-memory DB
// 3. teamotp.db
function resolve_db_path(): string {
	const configured_path = Bun.env.TEAMOTP_DB_PATH?.trim()
	if (!configured_path) {
		return is_test_run ? ':memory:' : path.join(data_dir, 'teamotp.db')
	}

	if (path.isAbsolute(configured_path)) {
		return configured_path
	}

	return path.join(data_dir, configured_path)
}

export function listEntries(): OtpDisplayInfo[] {
	return db
		.select({
			id: entries.id,
			label: entries.label,
			issuer: entries.issuer,
			issuer_second: entries.issuer_second,
			usage_count: entries.usage_count,
			period: entries.period,
		})
		.from(entries)
		.all()
}

export function createEntry(obj: NewOtpEntry): OtpEntry {
	const id = Bun.randomUUIDv7()
	const algo = obj.algorithm?.toLowerCase() ?? 'sha1'

	const entry: OtpEntry = {
		id,
		label: obj.label,
		issuer: obj.issuer ?? '',
		issuer_second: obj.issuer_second ?? '',
		usage_count: 0,
		secret: obj.secret.toUpperCase(),
		algorithm: algo as HashAlgorithm,
		digits: obj.digits ?? 6,
		period: obj.period ?? 30,
	}

	db.insert(entries).values(entry).run()

	return entry
}

export function getEntryById(id: string): OtpEntry | null {
	const row = db.select().from(entries).where(eq(entries.id, id)).get()
	return (row as OtpEntry | null) ?? null
}

export function updateEntry(id: string, updated: UpdateOtpEntry): void {
	db.update(entries).set(updated).where(eq(entries.id, id)).run()
}

export function incrementEntryAccessCount(id: string): void {
	db.update(entries)
		.set({ usage_count: sql`${entries.usage_count} + 1` })
		.where(eq(entries.id, id))
		.run()
}

export function getUserByEmail(email: string): User | null {
	const row = db.select().from(users).where(eq(users.email, email)).get()
	return (row as User | null) ?? null
}

export function getUserByProviderId(providerId: string): User | null {
	const row = db.select().from(users).where(eq(users.provider_id, providerId)).get()
	return (row as User | null) ?? null
}

export function upsertMicrosoftUser(params: { providerId: string; email: string }): User {
	// User exists
	const existing = getUserByProviderId(params.providerId)
	if (existing) {
		return existing
	}

	// Local user with mail exists. Link Microsoft provider to existing user
	const existingByEmail = getUserByEmail(params.email)
	if (existingByEmail) {
		db.update(users)
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
		email: params.email,
		password_hash: null,
		provider: 'microsoft',
		provider_id: params.providerId,
	}
	db.insert(users).values(user).run()
	return user
}
