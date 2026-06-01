import { execFileSync } from 'node:child_process'
import path from 'node:path'

export const E2E_DB_PATH = path.resolve(process.cwd(), 'server', 'data', 'e2e.db')

async function globalSetup() {
	execFileSync('bun', ['run', 'tests/e2e/seed-db.ts'], {
		cwd: process.cwd(),
		stdio: 'inherit',
		env: {
			...process.env,
			TEAMOTP_DB_PATH: E2E_DB_PATH,
		},
	})
}

export default globalSetup
