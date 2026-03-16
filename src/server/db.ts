import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const DATA_DIR = join(process.cwd(), 'data')
if (!existsSync(DATA_DIR)) {
	mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = join(DATA_DIR, 'teamotp.db')
export const db = new Database(DB_PATH, { create: true })

// Initialize schema
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
