import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import { SESSION_ABSOLUTE_TIMEOUT_S, SESSION_IDLE_TIMEOUT_S } from 'shared/src/session'
import { type AppConfig, getConfig, initConfig } from '../config'
import { db } from '../db'
import { app } from '../index'
import { users } from '../schema'
import { createAuthCookie } from '../tests/helpers'

beforeEach(async () => {
	db.delete(users).run()
})

afterEach(() => {
	setSystemTime() // back to the real clock, even if a test threw
	initConfig(originalConfig) // restore config overridden by a cookie test
})

const originalConfig: AppConfig = JSON.parse(JSON.stringify(getConfig()))

function loginRequest(): Promise<Response> {
	return Promise.resolve(
		app.request('/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'test@example.com', password: 'correct_password' }),
		}),
	)
}

async function insertLoginUser(): Promise<void> {
	const hash = await Bun.password.hash('correct_password')
	db.insert(users).values({ id: 'u1', email: 'test@example.com', password_hash: hash }).run()
}

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
		await insertLoginUser()

		const response = await loginRequest()

		expect(response.status).toBe(200)
		const setCookie = response.headers.get('set-cookie')
		expect(setCookie).not.toBeNull()
		expect(setCookie).toContain('auth_token=')
	})

	test('sets the Secure flag on the session cookie by default', async () => {
		await insertLoginUser()
		// Init config withou secureCookies, so the default is used
		initConfig({ ...originalConfig, auth: { ...originalConfig.auth } })

		const response = await loginRequest()

		const setCookie = response.headers.get('set-cookie')
		expect(setCookie).toContain('Secure')
	})

	test('logs out successfully (clears cookie)', async () => {
		const cookie = await createAuthCookie()

		const response = await app.request('/auth/logout', {
			method: 'POST',
			headers: {
				Cookie: cookie,
			},
		})
		expect(response.status).toBe(200)
		const setCookie = response.headers.get('set-cookie')
		expect(setCookie).not.toBeNull()
		expect(setCookie).toContain('auth_token=')
		expect(setCookie).toContain('Max-Age=0') // clears cookie
	})

	test('/me rejects a session that idled out', async () => {
		// Long lived JWT, so the rejection can only come from the idle timeout
		const now = Math.floor(Date.now() / 1000)
		const cookie = await createAuthCookie({ exp: now + SESSION_ABSOLUTE_TIMEOUT_S })

		setSystemTime(new Date(Date.now() + SESSION_IDLE_TIMEOUT_S * 1000))
		const response = await app.request('/auth/me', { headers: { Cookie: cookie } })

		expect(response.status).toBe(401)
	})

	test('/me keeps a session alive while it is used', async () => {
		const now = Math.floor(Date.now() / 1000)
		const cookie = await createAuthCookie({ exp: now + SESSION_ABSOLUTE_TIMEOUT_S })

		// Two nearly full idle windows in a row, each request restarting the window
		setSystemTime(new Date(Date.now() + (SESSION_IDLE_TIMEOUT_S - 60) * 1000))
		const first = await app.request('/auth/me', { headers: { Cookie: cookie } })

		setSystemTime(new Date(Date.now() + (SESSION_IDLE_TIMEOUT_S - 60) * 1000))
		const second = await app.request('/auth/me', { headers: { Cookie: cookie } })

		expect(first.status).toBe(200)
		expect(second.status).toBe(200)
	})

	test('/me requires authentication', async () => {
		const response = await app.request('/auth/me')
		expect(response.status).toBe(401)

		const cookie = await createAuthCookie()

		const authedResponse = await app.request('/auth/me', {
			headers: {
				Cookie: cookie,
			},
		})
		expect(authedResponse.status).toBe(200)
		expect(await authedResponse.json()).toEqual({ email: 'test@example.com' })
	})
})
