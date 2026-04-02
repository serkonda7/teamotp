import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth } from './middleware/requireAuth'
import { handleCallback, handleLogin, handleLogout, handleMe } from './routes/auth'
import { handleCreateOtp, handleGetOtpCode, handleListOtp, handleUpdateOtp } from './routes/otp'

export const app = new Hono()
	.use('/*', cors())
	.get('/auth/login', handleLogin)
	.get('/auth/callback', handleCallback)
	.post('/auth/logout', handleLogout)
	.get('/auth/me', handleMe)
	.use('/otp*', requireAuth)
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
