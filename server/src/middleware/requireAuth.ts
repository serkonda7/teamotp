import type { MiddlewareHandler } from 'hono'
import { getCookie } from 'hono/cookie'
import { getAuthConfig, verifySessionToken } from '../auth'
import { SESSION_COOKIE } from '../routes/auth'

export const requireAuth: MiddlewareHandler = async (c, next) => {
	const config = getAuthConfig()
	if (!config) {
		// Auth is not configured — allow all requests (dev / test mode)
		await next()
		return
	}

	const token = getCookie(c, SESSION_COOKIE)
	if (!token) {
		return c.json({ error: 'Unauthorized' }, 401)
	}

	try {
		await verifySessionToken(token, config.sessionSecret)
		await next()
	} catch {
		return c.json({ error: 'Invalid session' }, 401)
	}
}
