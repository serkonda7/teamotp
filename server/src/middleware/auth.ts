import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { config } from '../config'

export type JwtPayload = { sub: string; email: string; exp: number }

export const authMiddleware = createMiddleware<{ Variables: { jwtPayload: JwtPayload } }>(
	async (c, next) => {
		const token = getCookie(c, 'auth_token')
		if (!token) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		const secret = config.auth.jwtSecret

		try {
			const payload = await verify(token, secret, 'HS256')
			c.set('jwtPayload', payload)
			await next()
		} catch (_e) {
			return c.json({ error: 'Unauthorized' }, 401)
		}
	},
)
