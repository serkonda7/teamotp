import { Result } from 'better-result'
import { and, count, eq } from 'drizzle-orm'
import { normalize_key } from 'shared/src/normalize'
import type { NewTag, TagInfo, TagWithMemberCount } from 'shared/src/types'
import { entry_tags, tags } from '../schema'
import { getDb } from './connection'
import { DuplicateTagError, isForeignKeyViolation, isUniqueViolation } from './errors'

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

/**
 * Inserts a tag. The `normalized_name UNIQUE` constraint is the source of
 * truth under concurrency: the route keeps its `getTagByName` pre-check for
 * the fast path, but two racing `POST /tags` with the same name resolve here
 * to `Result.err(DuplicateTagError)` instead of a 500.
 */
export function createTag(obj: NewTag): Result<TagInfo, Error> {
	// Name case is preserved for display; color already arrives lower-cased
	// from the schema. Only normalized_name lower-cases here, as the safety
	// net behind the unique index (plus the SQL backfill in 0008).
	const displayName = obj.name.trim()
	const tag: TagInfo = {
		id: Bun.randomUUIDv7(),
		name: displayName,
		color: obj.color,
	}
	try {
		getDb()
			.insert(tags)
			.values({
				id: tag.id,
				name: displayName,
				normalized_name: normalize_key(displayName),
				color: tag.color,
			})
			.run()
		return Result.ok(tag)
	} catch (err) {
		if (isUniqueViolation(err)) {
			return Result.err(new DuplicateTagError())
		}
		return Result.err(err instanceof Error ? err : new Error(String(err)))
	}
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

/**
 * Deletes a tag and its assignments atomically. A crash between the two
 * deletes previously orphaned the tag; `db.transaction()` rolls both back.
 */
export function deleteTag(id: string): boolean {
	if (!getTagById(id)) {
		return false
	}

	getDb().transaction((tx) => {
		tx.delete(entry_tags).where(eq(entry_tags.tag_id, id)).run()
		tx.delete(tags).where(eq(tags.id, id)).run()
	})
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

/**
 * Idempotent assign (`onConflictDoNothing`). An FK violation means the entry
 * or tag vanished between the route's existence check and this insert
 * (concurrent delete); callers map that to 404 instead of a 500.
 */
export function assignTag(entryId: string, tagId: string): Result<void, Error> {
	try {
		getDb()
			.insert(entry_tags)
			.values({ entry_id: entryId, tag_id: tagId })
			.onConflictDoNothing()
			.run()
		return Result.ok(undefined)
	} catch (err) {
		if (isForeignKeyViolation(err)) {
			return Result.err(new Error('OTP entry or tag not found'))
		}
		return Result.err(err instanceof Error ? err : new Error(String(err)))
	}
}

export function unassignTag(entryId: string, tagId: string): void {
	getDb()
		.delete(entry_tags)
		.where(and(eq(entry_tags.entry_id, entryId), eq(entry_tags.tag_id, tagId)))
		.run()
}
