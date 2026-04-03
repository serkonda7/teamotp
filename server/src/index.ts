import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { authApp } from './routes/auth'
import { handleCreateOtp, handleGetOtpCode, handleListOtp, handleUpdateOtp } from './routes/otp'

export const app = new Hono()
	.use('/*', cors())
	.route('/auth', authApp)
	.get('/otp', authMiddleware, handleListOtp)
	.post('/otp', authMiddleware, handleCreateOtp)
	.get('/otp/:id', authMiddleware, handleGetOtpCode)
	.post('/otp/:id', authMiddleware, handleUpdateOtp)

export type AppType = typeof app

if (import.meta.main) {
	if (!process.env.JWT_SECRET) {
		console.error('FATAL Error: JWT_SECRET environment variable is completely missing.')
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
