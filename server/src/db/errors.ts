/** Shared SQLite error predicates. Drizzle rethrows the raw Bun SQLiteError. */

/** Matches a SQLite error by its error code or, failing that, a message fragment. */
function hasSqliteError(err: unknown, code: string, message: string): boolean {
	if (!(err instanceof Error)) {
		return false
	}
	return (err as Error & { code?: unknown }).code === code || err.message.includes(message)
}

export function isUniqueViolation(err: unknown): boolean {
	return hasSqliteError(err, 'SQLITE_CONSTRAINT_UNIQUE', 'UNIQUE constraint failed')
}

export function isForeignKeyViolation(err: unknown): boolean {
	return hasSqliteError(err, 'SQLITE_CONSTRAINT_FOREIGNKEY', 'FOREIGN KEY constraint failed')
}

/** Thrown (wrapped in a `Result.err`) when a tag name collides under concurrency. */
export class DuplicateTagError extends Error {
	constructor() {
		super('A tag with this name already exists')
		this.name = 'DuplicateTagError'
	}
}
