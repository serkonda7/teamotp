import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import type { HashAlgorithm } from 'otplib'
import type { NewOtpEntry, OtpDisplayInfo } from 'shared/src/types'
import { entries } from './schema'
import type { OtpEntry, UpdateOtpEntry } from './types'

const data_dir = path.join(process.cwd(), 'data')
fs.mkdirSync(data_dir, { recursive: true })
// TODO enrypt entire DB

// Precedence for DB file path:
// 1. TEAMOTP_DB_PATH env var
// 2. if test: teamotp.test.db
// 3. teamotp.db
const is_test_run = Bun.env.NODE_ENV === 'test'
const default_db_file = is_test_run ? 'teamotp.test.db' : 'teamotp.db'
const db_path = Bun.env.TEAMOTP_DB_PATH ?? path.join(data_dir, default_db_file)

// Create or open the database file and run migrations
const migrations_folder = path.join(process.cwd(), 'drizzle')
if (!fs.existsSync(path.join(migrations_folder, 'meta/_journal.json'))) {
	throw new Error(`Drizzle migrations not found at ${migrations_folder}.`)
}
const sqlite = new Database(db_path, { create: true, strict: true })

export const db = drizzle(sqlite)
migrate(db, { migrationsFolder: migrations_folder })

export function listEntries(): OtpDisplayInfo[] {
	return db
		.select({ id: entries.id, label: entries.label, issuer: entries.issuer })
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
		secret: obj.secret.toLowerCase(),
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

export function updateEntry(_id: string, _updated: UpdateOtpEntry): void {
	// TODO implement updateEntry
}
