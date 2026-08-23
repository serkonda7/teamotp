import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { type AppConfig, getConfig, initConfig } from '../config'
import { db } from '../db'
import { app } from '../index'
import { reset_rate_limits } from '../middleware/rate_limit'
import { users } from '../schema'

const originalConfig: AppConfig = JSON.parse(JSON.stringify(getConfig()))

function loginRequest(ip: string, password = 'wrong_password'): Promise<Response> {
	return Promise.resolve(
		app.request('/auth/login', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
			body: JSON.stringify({ email: 'ratelimit@example.com', password }),
		}),
	)
}

async function insertLoginUser(): Promise<void> {
	const hash = await Bun.password.hash('correct_password')
	db.insert(users)
		.values({ id: 'rl1', email: 'ratelimit@example.com', password_hash: hash })
		.run()
}

beforeEach(async () => {
	reset_rate_limits()
	db.delete(users).run()
	initConfig({
		...originalConfig,
		auth: {
			...originalConfig.auth,
			secureCookies: false,
			loginRateLimit: { maxAttempts: 2, windowSeconds: 300 },
		},
	})
})

afterEach(() => {
	initConfig(originalConfig)
})

describe('login rate limit', () => {
	test('returns 429 with Retry-After after maxAttempts', async () => {
		expect((await loginRequest('10.0.0.1')).status).toBe(401)
		expect((await loginRequest('10.0.0.1')).status).toBe(401)

		const blocked = await loginRequest('10.0.0.1')

		expect(blocked.status).toBe(429)
		const retryAfter = blocked.headers.get('retry-after')
		expect(retryAfter).not.toBeNull()
		expect(Number(retryAfter)).toBeGreaterThan(0)
	})

	test('successful login resets the counter', async () => {
		await insertLoginUser()

		await loginRequest('10.0.0.2') // 401
		await loginRequest('10.0.0.2', 'correct_password') // 200 → resets

		expect((await loginRequest('10.0.0.2')).status).toBe(401)
	})

	test('different IPs get independent budgets', async () => {
		expect((await loginRequest('10.0.0.3')).status).toBe(401)
		expect((await loginRequest('10.0.0.3')).status).toBe(401)
		expect((await loginRequest('10.0.0.3')).status).toBe(429)

		expect((await loginRequest('10.0.0.4')).status).toBe(401)
	})
})
