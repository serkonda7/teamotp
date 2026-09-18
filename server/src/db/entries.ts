import { Result } from 'better-result'
import { eq, isNull } from 'drizzle-orm'
import type { HashAlgorithm } from 'otplib'
import type { NewOtpEntry, OtpDisplayInfo, TagInfo } from 'shared/src/types'
import { generateTotpCode } from '../otp'
import { entries, entry_tags, tags } from '../schema'
import type { OtpEntry, UpdateOtpEntry } from '../types'
import { getDb } from './connection'

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
