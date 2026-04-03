import { beforeEach, describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { db, getEntryById } from '../db'
import { app } from '../index'
import { entries } from '../schema'

const TEST_SECRET = 'test_secret'

async function getAuthHeaders() {
	const token = await sign({ sub: 'user_id', email: 'test@example.com' }, TEST_SECRET, 'HS256')
	return {
		cookie: `auth_token=${token}`,
	}
}

beforeEach(() => {
	db.delete(entries).run()
})

describe('OTP routes', () => {
	test('validates required fields in create endpoint', async () => {
		const headers = await getAuthHeaders()
		const response = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ label: 'missing-secret' }),
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Fields "label" and "secret" are required' })
	})

	test('creates an OTP entry with defaults and lists it', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Personal account',
				issuer: 'example.com',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})

		expect(createResponse.status).toBe(201)
		const createBody = (await createResponse.json()) as { id: string }
		expect(createBody.id.length).toBeGreaterThan(0)

		const stored = getEntryById(createBody.id)
		expect(stored).not.toBeNull()
		expect(stored?.algorithm).toBe('sha1')
		expect(stored?.digits).toBe(6)
		expect(stored?.period).toBe(30)
		expect(stored?.secret).toBe('jbswy3dpehpk3pxpjbswy3dpehpk3pxp')

		const listResponse = await app.request('/otp', {
			headers: { ...headers },
		})
		expect(listResponse.status).toBe(200)
		expect(await listResponse.json()).toEqual([
			{
				id: createBody.id,
				label: 'Personal account',
				issuer: 'example.com',
			},
		])
	})

	test('returns 404 for unknown OTP id', async () => {
		const headers = await getAuthHeaders()
		const response = await app.request('/otp/not-found', {
			headers: { ...headers },
		})
		expect(response.status).toBe(404)
		expect(await response.json()).toEqual({ error: 'OTP entry not found' })
	})

	test('returns a TOTP code for an existing entry', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Work account',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
				digits: 8,
			}),
		})

		expect(createResponse.status).toBe(201)
		const createBody = (await createResponse.json()) as { id: string }

		const codeResponse = await app.request(`/otp/${createBody.id}`, {
			headers: { ...headers },
		})
		expect(codeResponse.status).toBe(200)
		const codeBody = (await codeResponse.json()) as { code: string }
		expect(codeBody.code).toMatch(/^\d{8}$/)
	})
})
