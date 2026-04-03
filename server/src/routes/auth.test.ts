import { beforeEach, describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { db } from '../db'
import { app } from '../index'
import { users } from '../schema'
import { createSessionId } from '../sessions'

const TEST_SECRET = 'test_secret'

beforeEach(async () => {
	db.delete(users).run()
})

describe('Auth routes', () => {
	test('requires email and password or returns 400', async () => {
		const response = await app.request('/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com' }), // missing password
		})
		expect(response.status).toBe(400)
	})

	test('rejects login for unknown user', async () => {
		const response = await app.request('/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'nope@example.com', password: 'password123' }),
		})
		expect(response.status).toBe(401)
	})

	test('rejects login for wrong password', async () => {
		const hash = await Bun.password.hash('correct_password')
		db.insert(users).values({ id: 'u1', email: 'test@example.com', password_hash: hash }).run()

		const response = await app.request('/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'wrong_password' }),
		})
		expect(response.status).toBe(401)
	})

	test('accepts valid login and returns cookie', async () => {
		const hash = await Bun.password.hash('correct_password')
		db.insert(users).values({ id: 'u1', email: 'test@example.com', password_hash: hash }).run()

		const response = await app.request('/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'correct_password' }),
		})

		expect(response.status).toBe(200)
		const setCookie = response.headers.get('set-cookie')
		expect(setCookie).not.toBeNull()
		expect(setCookie).toContain('auth_token=')
	})

	test('logs out successfully (clears cookie)', async () => {
		const sid = createSessionId()
		const token = await sign(
			{ sub: 'user_id', email: 'test@example.com', sid },
			TEST_SECRET,
			'HS256',
		)

		const response = await app.request('/auth/logout', {
			method: 'POST',
			headers: {
				Cookie: `auth_token=${token}`,
			},
		})
		expect(response.status).toBe(200)
		const setCookie = response.headers.get('set-cookie')
		expect(setCookie).not.toBeNull()
		expect(setCookie).toContain('auth_token=')
		expect(setCookie).toContain('Max-Age=0') // clears cookie
	})

	test('/me requires authentication', async () => {
		const response = await app.request('/auth/me')
		expect(response.status).toBe(401)

		const sid = createSessionId()
		const token = await sign(
			{ sub: 'user_id', email: 'test@example.com', sid },
			TEST_SECRET,
			'HS256',
		)

		const authedResponse = await app.request('/auth/me', {
			headers: {
				Cookie: `auth_token=${token}`,
			},
		})
		expect(authedResponse.status).toBe(200)
		expect(await authedResponse.json()).toEqual({ email: 'test@example.com' })
	})
})
