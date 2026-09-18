import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { Result } from 'better-result'
import { and, count, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import type { HashAlgorithm } from 'otplib'
import { normalize_key } from 'shared/src/normalize'
import type {
	NewOtpEntry,
	NewTag,
	OtpDisplayInfo,
	TagInfo,
	TagWithMemberCount,
} from 'shared/src/types'
import { generateTotpCode } from './otp'
import { entries, entry_tags, tags, users } from './schema'
import type { OtpEntry, UpdateOtpEntry, User } from './types'
import { normalize_email } from './util/email'
import { get_server_root, getTrimmedEnv, resolveInDataDir } from './util/server_root'

export type DbHandle = ReturnType<typeof drizzle>

let dbInstance: DbHandle | null = null
let sqliteInstance: Database | null = null

/**
 * Returns the initialized drizzle handle. Throws a clear error when `initDb`
 * was not called — the same shape as `getConfig`, so a missing startup step
 * is obvious instead of a `Cannot read properties of null`.
 */
export function getDb(): DbHandle {
	if (!dbInstance) {
		throw new Error('Database has not been initialized. Call initDb() during startup.')
	}
	return dbInstance
}

/** Returns the underlying Bun SQLite handle (used for transactions on one connection). */
export function getSqliteHandle(): Database {
	if (!sqliteInstance) {
		throw new Error('Database has not been initialized. Call initDb() during startup.')
	}
	return sqliteInstance
}

export interface InitDbOptions {
	dbPath?: string
	migrationsFolder?: string
	serverRoot?: string
}

/**
 * Opens the database file and runs migrations. Must be called once during
 * startup (or test setup) — importing this module alone opens nothing.
 * Idempotent: repeated calls return the existing handle.
 */
export function initDb(options: InitDbOptions = {}): DbHandle {
	if (dbInstance && sqliteInstance) {
		return dbInstance
	}

	let serverRoot = options.serverRoot
	if (!serverRoot) {
		const rootRes = get_server_root()
		if (Result.isError(rootRes)) {
			throw new Error(`Failed to initialize database: ${rootRes.error.message}`)
		}
		serverRoot = Result.unwrap(rootRes)
	}

	const migrationsFolder = options.migrationsFolder ?? path.join(serverRoot, 'drizzle')
	if (!fs.existsSync(path.join(migrationsFolder, 'meta/_journal.json'))) {
		throw new Error(`Drizzle migrations not found at ${migrationsFolder}.`)
	}

	const dbPath = options.dbPath ?? resolve_db_path(serverRoot)
	if (dbPath !== ':memory:') {
		fs.mkdirSync(path.dirname(dbPath), { recursive: true })
	}
	const sqlite = new Database(dbPath, { create: true, strict: true })
	sqlite.exec('PRAGMA foreign_keys = ON')

	const db = drizzle(sqlite)
	migrate(db, { migrationsFolder })

	dbInstance = db
	sqliteInstance = sqlite
	return db
}

// Precedence for DB path:
// 1. TEAMOTP_DB_PATH env var (`:memory:` for an in-memory DB)
// 2. teamotp.db
function resolve_db_path(serverRoot: string): string {
	const configured_path = getTrimmedEnv('TEAMOTP_DB_PATH')
	if (!configured_path) {
		return path.join(serverRoot, 'data', 'teamotp.db')
	}

	if (configured_path === ':memory:') {
		return configured_path
	}

	return resolveInDataDir(serverRoot, configured_path)
}

export function listEntries(includeArchived = false): OtpDisplayInfo[] {
	const baseQuery = getDb()
		.select({
			id: entries.id,
			label: entries.label,
			issuer: entries.issuer,
			issuer_second: entries.issuer_second,
			period: entries.period,
		})
		.from(entries)

	const rows = includeArchived
		? baseQuery.all()
		: baseQuery.where(isNull(entries.archived_at)).all()

	const tagsByEntry = listAllEntryTagsGrouped()
	return rows.map((row) => ({ ...row, tags: tagsByEntry.get(row.id) ?? [] }))
}

function listAllEntryTagsGrouped(): Map<string, TagInfo[]> {
	const tagRows = getDb()
		.select({
			entry_id: entry_tags.entry_id,
			id: tags.id,
			name: tags.name,
			color: tags.color,
		})
		.from(entry_tags)
		.innerJoin(tags, eq(entry_tags.tag_id, tags.id))
		.all()

	const grouped = new Map<string, TagInfo[]>()
	for (const row of tagRows) {
		const list = grouped.get(row.entry_id) ?? []
		list.push({ id: row.id, name: row.name, color: row.color })
		grouped.set(row.entry_id, list)
	}

	return grouped
}

/**
 * Creates an entry, but only if its secret actually produces a code.
 *
 * The check lives here rather than in the route so no caller can store a row
 * that permanently fails on read: a secret the schema accepts can still be
 * rejected by the otplib guardrails.
 */
export function createEntry(obj: NewOtpEntry): Result<OtpEntry, Error> {
	const id = Bun.randomUUIDv7()
	// Case is normalized once at the schema boundary (shared/src/schemas.ts):
	// secret arrives upper-cased, algorithm lower-cased. No re-normalization
	// here so the layers cannot drift apart.
	const algo = obj.algorithm ?? 'sha1'

	const entry: OtpEntry = {
		id,
		label: obj.label,
		issuer: obj.issuer ?? '',
		issuer_second: obj.issuer_second ?? '',
		secret: obj.secret,
		algorithm: algo as HashAlgorithm,
		digits: obj.digits ?? 6,
		period: obj.period ?? 30,
		archived_at: null,
	}

	const code_res = generateTotpCode(entry)
	if (Result.isError(code_res)) {
		return code_res
	}

	getDb().insert(entries).values(entry).run()

	return Result.ok(entry)
}

export function getEntryById(id: string): OtpEntry | null {
	const row = getDb().select().from(entries).where(eq(entries.id, id)).get()
	return (row as OtpEntry | null) ?? null
}

/**
 * Applies the updatable fields of an entry.
 *
 * The whitelist is enforced here and not only at the route boundary: spreading
 * a caller-supplied object into `.set()` would make this a mass-assignment
 * primitive for every future call site, including ones that forget to validate.
 */
export function updateEntry(id: string, updated: UpdateOtpEntry): void {
	// Explicit keys only — never spread a caller-supplied object into .set()
	const fields: Partial<typeof entries.$inferInsert> = {}
	if (updated.label !== undefined) {
		fields.label = updated.label
	}
	if (updated.issuer !== undefined) {
		fields.issuer = updated.issuer
	}
	if (updated.issuer_second !== undefined) {
		fields.issuer_second = updated.issuer_second
	}

	if (Object.keys(fields).length === 0) {
		return
	}
	getDb().update(entries).set(fields).where(eq(entries.id, id)).run()
}

export function archiveEntry(id: string): string | null {
	const existing = getEntryById(id)
	if (!existing) {
		return null
	}

	if (existing.archived_at) {
		return existing.archived_at
	}

	// ISO string by design: archived_at is a TEXT column (human-readable in the
	// DB), unlike the integer-seconds clock domains that use nowSeconds().
	const archivedAt = new Date().toISOString()
	getDb().update(entries).set({ archived_at: archivedAt }).where(eq(entries.id, id)).run()
	return archivedAt
}

export function listTags(): TagWithMemberCount[] {
	return getDb()
		.select({
			id: tags.id,
			name: tags.name,
			color: tags.color,
			member_count: count(entry_tags.entry_id),
		})
		.from(tags)
		.leftJoin(entry_tags, eq(tags.id, entry_tags.tag_id))
		.groupBy(tags.id)
		.all()
}

export function createTag(obj: NewTag): TagInfo {
	// Name case is preserved for display; color already arrives lower-cased
	// from the schema. Only normalized_name lower-cases here, as the safety
	// net behind the unique index (plus the SQL backfill in 0008).
	const displayName = obj.name.trim()
	const tag: TagInfo = {
		id: Bun.randomUUIDv7(),
		name: displayName,
		color: obj.color,
	}
	getDb()
		.insert(tags)
		.values({
			id: tag.id,
			name: displayName,
			normalized_name: normalize_key(displayName),
			color: tag.color,
		})
		.run()
	return tag
}

export function getTagById(id: string): TagInfo | null {
	const row = getDb()
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(eq(tags.id, id))
		.get()
	return row ?? null
}

export function getTagByName(name: string): TagInfo | null {
	const row = getDb()
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(tags)
		.where(eq(tags.normalized_name, normalize_key(name)))
		.get()
	return row ?? null
}

export function deleteTag(id: string): boolean {
	if (!getTagById(id)) {
		return false
	}

	getDb().delete(entry_tags).where(eq(entry_tags.tag_id, id)).run()
	getDb().delete(tags).where(eq(tags.id, id)).run()
	return true
}

export function listEntryTags(entryId: string): TagInfo[] {
	return getDb()
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(entry_tags)
		.innerJoin(tags, eq(entry_tags.tag_id, tags.id))
		.where(eq(entry_tags.entry_id, entryId))
		.all()
}

export function assignTag(entryId: string, tagId: string): void {
	getDb()
		.insert(entry_tags)
		.values({ entry_id: entryId, tag_id: tagId })
		.onConflictDoNothing()
		.run()
}

export function unassignTag(entryId: string, tagId: string): void {
	getDb()
		.delete(entry_tags)
		.where(and(eq(entry_tags.entry_id, entryId), eq(entry_tags.tag_id, tagId)))
		.run()
}

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
