import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { AUDIT_SWEEP_INTERVAL_MS, pruneExpiredAuditLogs } from './audit'
import { type AppConfig, initConfig, load_config_file, resolve_listen_port } from './config'
import { authApp } from './routes/auth'
import { otpApp } from './routes/otp_routes'
import { tagApp } from './routes/tag_routes'
import { SESSION_SWEEP_INTERVAL_MS, sweepExpired } from './sessions'
import { jsonError } from './util/http'
import { start_sweep } from './util/periodic'
import { getTrimmedEnv, resolveInDataDir } from './util/server_root'

// Precedence for the config path:
// 1. TEAMOTP_CONFIG_PATH env var (absolute, or relative to the data dir)
// 2. config.toml
function resolve_config_path(): string {
	const configured_path = getTrimmedEnv('TEAMOTP_CONFIG_PATH')
	if (!configured_path) {
		return resolveInDataDir('config.toml')
	}

	return resolveInDataDir(configured_path)
}

export const app = new Hono()
	// Aborted requests (e.g. a malformed JSON body rejected by a validator) must
	// answer with the same `{ error }` shape as the handlers, because that is the
	// only field the client reads.
	.onError((err, c) => {
		if (err instanceof HTTPException) {
			return jsonError(c, err.message, err.status)
		}

		console.error(err)
		return jsonError(c, 'Internal server error', 500)
	})
	.route('/auth', authApp)
	.route('/otp', otpApp)
	.route('/tags', tagApp)
export type AppType = typeof app

if (import.meta.main) {
	// Load and set
	const configResult = load_config_file(resolve_config_path())
	let config: AppConfig
	if (configResult.isOk()) {
		config = configResult.value
		initConfig(config)
	} else {
		console.error(`Failed to start server: ${configResult.error.message}`)
		process.exit(1)
	}

	// Drop timed out sessions even while nobody tries to use them.
	// Scheduled here and not at module scope, so it never keeps a test process alive.
	sweepExpired()
	start_sweep(sweepExpired, SESSION_SWEEP_INTERVAL_MS)

	// Prune audit log rows older than the configured retention (default 90 days).
	pruneExpiredAuditLogs()
	start_sweep(pruneExpiredAuditLogs, AUDIT_SWEEP_INTERVAL_MS)

	const server = Bun.serve({
		hostname: config.server.host,
		port: resolve_listen_port(config),
		fetch: app.fetch,
	})

	console.log(`API running on ${server.url}`)
}
