import { Result } from 'better-result'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { initConfig, loadConfig } from './config'
import { authApp } from './routes/auth'
import { otpApp } from './routes/otp_routes'

export const app = new Hono().use('/*', cors()).route('/auth', authApp).route('/otp', otpApp)

export type AppType = typeof app

if (import.meta.main) {
	const configResult = loadConfig()
	if (Result.isError(configResult)) {
		console.error(`Failed to start server: ${configResult.error.message}`)
		process.exit(1)
	}

	initConfig(configResult.value)

	// TODO read port from config file or env variable
	const server = Bun.serve({
		hostname: '0.0.0.0',
		port: 3000,
		fetch: app.fetch,
	})

	console.log(`API running on ${server.url}`)
}
