/** Shared SQLite error predicates. Drizzle rethrows the raw Bun SQLiteError. */

export function isUniqueViolation(err: unknown): boolean {
	if (!(err instanceof Error)) {
		return false
	}
	const code = (err as Error & { code?: unknown }).code
	if (code === 'SQLITE_CONSTRAINT_UNIQUE') {
		return true
	}
	return err.message.includes('UNIQUE constraint failed')
}

export function isForeignKeyViolation(err: unknown): boolean {
	if (!(err instanceof Error)) {
		return false
	}
	const code = (err as Error & { code?: unknown }).code
	if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
		return true
	}
	return err.message.includes('FOREIGN KEY constraint failed')
}

/** Thrown (wrapped in a `Result.err`) when a tag name collides under concurrency. */
export class DuplicateTagError extends Error {
	constructor() {
		super('A tag with this name already exists')
		this.name = 'DuplicateTagError'
	}
}
