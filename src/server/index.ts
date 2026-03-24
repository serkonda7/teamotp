import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { handle_add_otp_entry, handle_get_otp_entries } from './routes/otp.ts'

const DATA_DIR = join(process.cwd(), 'data')
if (!existsSync(DATA_DIR)) {
	mkdirSync(DATA_DIR, { recursive: true })
}

const DB_PATH = join(DATA_DIR, 'teamotp.db')
const sqlite = new Database(DB_PATH, { create: true })
export const db = drizzle(sqlite)

const server = Bun.serve({
	// TODO: make this configurable
	hostname: '0.0.0.0',
	port: 3000,

	routes: {
		'/api/otp': {
			GET: handle_get_otp_entries,
			POST: handle_add_otp_entry,
		},
		'/*': Bun.file(join(process.cwd(), 'public', 'index.html')),
	},

	fetch(_req) {
		return new Response('not found', { status: 404 })
	},
})

console.log(`TeamOTP server listening on ${server.url}`)
