import { execFileSync } from 'node:child_process'
import { E2E_DB_PATH } from './servers'

async function globalSetup(): Promise<void> {
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
