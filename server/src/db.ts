import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { Result } from 'better-result'
import { and, count, eq, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import type { HashAlgorithm } from 'otplib'
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
import { SERVER_ROOT } from './util/server_root'

const data_dir = path.join(SERVER_ROOT, 'data')
// TODO enrypt entire DB

// Create or open the database file and run migrations
const migrations_folder = path.join(SERVER_ROOT, 'drizzle')
if (!fs.existsSync(path.join(migrations_folder, 'meta/_journal.json'))) {
	throw new Error(`Drizzle migrations not found at ${migrations_folder}.`)
}
const db_path = resolve_db_path()
console.log(`Using DB: ${db_path}`)
if (db_path !== ':memory:') {
	fs.mkdirSync(path.dirname(db_path), { recursive: true })
}
const sqlite = new Database(db_path, { create: true, strict: true })
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle(sqlite)
migrate(db, { migrationsFolder: migrations_folder })

// Precedence for DB path:
// 1. TEAMOTP_DB_PATH env var (`:memory:` for an in-memory DB)
// 2. teamotp.db
function resolve_db_path(): string {
	const configured_path = Bun.env.TEAMOTP_DB_PATH?.trim()
	if (!configured_path) {
		return path.join(data_dir, 'teamotp.db')
	}

	if (configured_path === ':memory:') {
		return configured_path
	}

	if (path.isAbsolute(configured_path)) {
		return configured_path
	}

	return path.join(data_dir, configured_path)
}

export function listEntries(includeArchived = false): OtpDisplayInfo[] {
	const baseQuery = db
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
	const tagRows = db
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
	const algo = obj.algorithm?.toLowerCase() ?? 'sha1'

	const entry: OtpEntry = {
		id,
		label: obj.label,
		issuer: obj.issuer ?? '',
		issuer_second: obj.issuer_second ?? '',
		secret: obj.secret.toUpperCase(),
		algorithm: algo as HashAlgorithm,
		digits: obj.digits ?? 6,
		period: obj.period ?? 30,
		archived_at: null,
	}

	const code_res = generateTotpCode(entry)
	if (Result.isError(code_res)) {
		return code_res
	}

	db.insert(entries).values(entry).run()

	return Result.ok(entry)
}

export function getEntryById(id: string): OtpEntry | null {
	const row = db.select().from(entries).where(eq(entries.id, id)).get()
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
	db.update(entries).set(fields).where(eq(entries.id, id)).run()
}

export function archiveEntry(id: string): string | null {
	const existing = getEntryById(id)
	if (!existing) {
		return null
	}

	if (existing.archived_at) {
		return existing.archived_at
	}

	const archivedAt = new Date().toISOString()
	db.update(entries).set({ archived_at: archivedAt }).where(eq(entries.id, id)).run()
	return archivedAt
}

export function listTags(): TagWithMemberCount[] {
	return db
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
	const tag: TagInfo = {
		id: Bun.randomUUIDv7(),
		name: obj.name.trim(),
		color: obj.color.toLowerCase(),
	}
	db.insert(tags).values(tag).run()
	return tag
}

export function getTagById(id: string): TagInfo | null {
	const row = db.select().from(tags).where(eq(tags.id, id)).get()
	return row ?? null
}

export function getTagByName(name: string): TagInfo | null {
	const row = db.select().from(tags).where(eq(tags.name, name)).get()
	return row ?? null
}

export function deleteTag(id: string): boolean {
	if (!getTagById(id)) {
		return false
	}

	db.delete(entry_tags).where(eq(entry_tags.tag_id, id)).run()
	db.delete(tags).where(eq(tags.id, id)).run()
	return true
}

export function listEntryTags(entryId: string): TagInfo[] {
	return db
		.select({ id: tags.id, name: tags.name, color: tags.color })
		.from(entry_tags)
		.innerJoin(tags, eq(entry_tags.tag_id, tags.id))
		.where(eq(entry_tags.entry_id, entryId))
		.all()
}

export function assignTag(entryId: string, tagId: string): void {
	db.insert(entry_tags).values({ entry_id: entryId, tag_id: tagId }).onConflictDoNothing().run()
}

export function unassignTag(entryId: string, tagId: string): void {
	db.delete(entry_tags)
		.where(and(eq(entry_tags.entry_id, entryId), eq(entry_tags.tag_id, tagId)))
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
