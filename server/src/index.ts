import path from 'node:path'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { initConfig, load_config_file } from './config'
import { authApp } from './routes/auth'
import { otpApp } from './routes/otp_routes'
import { tagApp } from './routes/tag_routes'
import { SERVER_ROOT } from './util/server_root'

const cfg_path = path.join(SERVER_ROOT, 'data', 'config.toml')

export const app = new Hono()
	.use('/*', cors())
	.route('/auth', authApp)
	.route('/otp', otpApp)
	.route('/tags', tagApp)
export type AppType = typeof app

if (import.meta.main) {
	// Load and set
	const configResult = load_config_file(cfg_path)
	if (configResult.isOk()) {
		initConfig(configResult.value)
	} else {
		console.error(`Failed to start server: ${configResult.error.message}`)
		process.exit(1)
	}

	// TODO read port from config file or env variable
	const server = Bun.serve({
		hostname: '0.0.0.0',
		port: 3000,
		fetch: app.fetch,
	})

	console.log(`API running on ${server.url}`)
}
