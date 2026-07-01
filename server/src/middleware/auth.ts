import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import { getConfig } from '../config'
import { isValidSession } from '../sessions'

export type JwtPayload = {
	sub: string // Subject (user email)
	jti: string // JWT ID, equivalent to session ID
	iat: number // Issued at
	exp: number // expiration time
	// Ignored fields: iss, aud, nbf
}

export const JWT_ALGO = 'HS256'

export const authMiddleware = createMiddleware<{ Variables: { jwtPayload: JwtPayload } }>(
	async (c, next) => {
		const token = getCookie(c, 'auth_token')
		if (!token) {
			return c.json({ error: 'Unauthorized' }, 401)
		}

		const secret = getConfig().auth.jwtSecret

		try {
			const payload = (await verify(token, secret, JWT_ALGO)) as JwtPayload

			if (!isValidSession(payload.jti)) {
				return c.json({ error: 'Unauthorized: Session invalidated' }, 401)
			}

			c.set('jwtPayload', payload)
			await next()
		} catch (_e) {
			return c.json({ error: 'Unauthorized' }, 401)
		}
	},
)
