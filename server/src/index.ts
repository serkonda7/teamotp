import path from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { initConfig, load_config_file } from './config'
import { authApp } from './routes/auth'
import { otpApp } from './routes/otp_routes'
import { tagApp } from './routes/tag_routes'
import { SESSION_SWEEP_INTERVAL_MS, sweepExpired } from './sessions'
import { SERVER_ROOT } from './util/server_root'

// Precedence for the config path:
// 1. TEAMOTP_CONFIG_PATH env var (absolute, or relative to the data dir)
// 2. config.toml
function resolve_config_path(): string {
	const data_dir = path.join(SERVER_ROOT, 'data')
	const configured_path = Bun.env.TEAMOTP_CONFIG_PATH?.trim()
	if (!configured_path) {
		return path.join(data_dir, 'config.toml')
	}

	if (path.isAbsolute(configured_path)) {
		return configured_path
	}

	return path.join(data_dir, configured_path)
}

export const app = new Hono()
	.use('/*', cors())
	// Aborted requests (e.g. a malformed JSON body rejected by a validator) must
	// answer with the same `{ error }` shape as the handlers, because that is the
	// only field the client reads.
	.onError((err, c) => {
		if (err instanceof HTTPException) {
			return c.json({ error: err.message }, err.status)
		}

		console.error(err)
		return c.json({ error: 'Internal server error' }, 500)
	})
	.route('/auth', authApp)
	.route('/otp', otpApp)
	.route('/tags', tagApp)
export type AppType = typeof app

if (import.meta.main) {
	// Load and set
	const configResult = load_config_file(resolve_config_path())
	if (configResult.isOk()) {
		initConfig(configResult.value)
	} else {
		console.error(`Failed to start server: ${configResult.error.message}`)
		process.exit(1)
	}

	// Drop timed out sessions even while nobody tries to use them.
	// Scheduled here and not at module scope, so it never keeps a test process alive.
	sweepExpired()
	setInterval(sweepExpired, SESSION_SWEEP_INTERVAL_MS).unref()

	// TODO read port from config file
	const server = Bun.serve({
		hostname: '0.0.0.0',
		port: Number(Bun.env.TEAMOTP_PORT?.trim() || 3000),
		fetch: app.fetch,
	})

	console.log(`API running on ${server.url}`)
}
