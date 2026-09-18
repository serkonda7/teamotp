import { initConfig } from '../config'
import { initDb } from '../db'

// Test config used when tests import server modules without running the full
// server. This replaces the former `NODE_ENV === 'test'` branch in config.ts,
// which shipped a hardcoded public secret inside the production binary.
// Modules have no import-time side effects, so the DB is initialized
// explicitly here after the in-memory path is set.
initConfig({
	auth: {
		appKey: 'test_app_key_0123456789abcdef_0123456789abcdef',
		jwtKeyVersion: 1,
		loginRateLimit: { maxAttempts: 10, windowSeconds: 300 },
		secureCookies: true,
		disableLocalLogin: false,
	},
	server: { host: '127.0.0.1', port: 3000 },
	audit: { retentionDays: 90 },
})
Bun.env.TEAMOTP_DB_PATH = ':memory:'
initDb()
