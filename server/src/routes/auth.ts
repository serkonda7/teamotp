import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { sign } from 'hono/jwt'
import { getUserByEmail } from '../db'
import { authMiddleware } from '../middleware/auth'

export const authApp = new Hono()

authApp.post('/login', async (c) => {
	const body = await c.req.json().catch(() => null)
	if (!body?.email || !body.password) {
		return c.json({ error: 'Email and password are required' }, 400)
	}

	const user = getUserByEmail(body.email)
	if (!user) {
		return c.json({ error: 'Invalid email or password' }, 401)
	}

	const isMatch = await Bun.password.verify(body.password, user.password_hash)
	if (!isMatch) {
		return c.json({ error: 'Invalid email or password' }, 401)
	}

	const secret = process.env.JWT_SECRET
	if (!secret) {
		return c.json({ error: 'Server misconfiguration: JWT_SECRET missing' }, 500)
	}

	const payload = {
		sub: user.id,
		email: user.email,
		exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 1 week
	}

	const token = await sign(payload, secret)

	setCookie(c, 'auth_token', token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'Strict',
		path: '/',
		maxAge: 60 * 60 * 24 * 7,
	})

	return c.json({ success: true })
})

authApp.post('/logout', async (c) => {
	deleteCookie(c, 'auth_token', {
		path: '/',
	})
	return c.json({ success: true })
})

authApp.get('/me', authMiddleware, (c) => {
	const payload = c.get('jwtPayload') as { email: string }
	return c.json({ email: payload.email })
})
