import { Database } from 'bun:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import type { HashAlgorithm } from 'otplib'
import type { NewOtpEntry, OtpDisplayInfo } from 'shared/src/types'
import type { OtpEntry, UpdateOtpEntry } from './types'

const data_dir = path.join(process.cwd(), 'data')
fs.mkdirSync(data_dir, { recursive: true })
// TODO use orm, e.g. drizzle
// TODO enrypt entire DB

// Precedence for DB file path:
// 1. TEAMOTP_DB_PATH env var
// 2. if test: teamotp.test.db
// 3. teamotp.db
const is_test_run = Bun.argv.includes('test')
const default_db_file = is_test_run ? 'teamotp.test.db' : 'teamotp.db'
const db_path = Bun.env.TEAMOTP_DB_PATH ?? path.join(data_dir, default_db_file)
export const db = new Database(db_path, { create: true, strict: true })

db.run(`
CREATE TABLE IF NOT EXISTS entries (
	id TEXT PRIMARY KEY,
	label TEXT NOT NULL,
	issuer TEXT NOT NULL,
	secret TEXT NOT NULL,
	algorithm TEXT NOT NULL,
	digits INTEGER NOT NULL,
	period INTEGER NOT NULL
)
`)

export function listEntries(): OtpDisplayInfo[] {
	const query = db.query('SELECT id, label, issuer FROM entries')
	const rows = query.all()
	return rows as OtpDisplayInfo[]
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

	db.run(
		'INSERT INTO entries (id, label, issuer, secret, algorithm, digits, period) VALUES (?, ?, ?, ?, ?, ?, ?)',
		[id, entry.label, entry.issuer, entry.secret, entry.algorithm, entry.digits, entry.period],
	)

	return entry
}

export function getEntryById(id: string): OtpEntry | null {
	const query = db.query(
		'SELECT id, label, issuer, secret, algorithm, digits, period FROM entries WHERE id = ?',
	)
	const row = query.get(id)
	return (row as OtpEntry | null) ?? null
}

export function updateEntry(_id: string, _updated: UpdateOtpEntry): void {
	// TODO implement updateEntry
}
