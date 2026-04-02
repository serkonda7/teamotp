import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handleCreateOtp, handleGetOtpCode, handleListOtp, handleUpdateOtp } from './routes/otp'

export const app = new Hono()
	.use('/*', cors())
	.get('/otp', handleListOtp)
	.post('/otp', handleCreateOtp)
	.get('/otp/:id', handleGetOtpCode)
	.post('/otp/:id', handleUpdateOtp)

export type AppType = typeof app

if (import.meta.main) {
	// TODO read port from config file or env variable
	const server = Bun.serve({
		hostname: '0.0.0.0',
		port: 3000,
		fetch: app.fetch,
	})

	console.log(`API running on ${server.url}`)
}
