import { beforeEach, describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { db, getEntryById } from '../db'
import { app } from '../index'
import type { JwtPayload } from '../middleware/auth'
import { entries } from '../schema'
import { createSessionId } from '../sessions'

const TEST_SECRET = 'test_secret'

// TODO make this a shared mock function between all tests as all were quite flaky
async function getAuthHeaders(): Promise<{ cookie: string }> {
	const sid = createSessionId()
	const token = await sign(
		{ sub: 'test@example.com', jti: sid } as JwtPayload,
		TEST_SECRET,
		'HS256',
	)
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
		expect(stored?.secret).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
		expect(stored?.issuer_second).toBe('')

		const listResponse = await app.request('/otp', {
			headers: { ...headers },
		})
		expect(listResponse.status).toBe(200)
		expect(await listResponse.json()).toEqual([
			{
				id: createBody.id,
				label: 'Personal account',
				issuer: 'example.com',
				issuer_second: '',
				period: 30,
			},
		])
	})

	test('stores issuer_second when provided', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'test@firma.onmicrosoft.com',
				issuer: 'Microsoft',
				issuer_second: 'Test Firma',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})

		expect(createResponse.status).toBe(201)
		const createBody = (await createResponse.json()) as { id: string }

		const stored = getEntryById(createBody.id)
		expect(stored).not.toBeNull()
		expect(stored?.issuer).toBe('Microsoft')
		expect(stored?.issuer_second).toBe('Test Firma')
		expect(stored?.label).toBe('test@firma.onmicrosoft.com')
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

	test('updates an existing OTP entry', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Old Label',
				issuer: 'Old Issuer',
				issuer_second: 'Old Second',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})

		expect(createResponse.status).toBe(201)
		const createBody = (await createResponse.json()) as { id: string }

		const updateResponse = await app.request(`/otp/${createBody.id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'New Label',
				issuer: 'New Issuer',
				issuer_second: 'New Second',
			}),
		})

		expect(updateResponse.status).toBe(200)
		expect(await updateResponse.json()).toEqual({ success: true })

		const stored = getEntryById(createBody.id)
		expect(stored).not.toBeNull()
		expect(stored?.label).toBe('New Label')
		expect(stored?.issuer).toBe('New Issuer')
		expect(stored?.issuer_second).toBe('New Second')
		expect(stored?.secret).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
	})

	test('returns 404 when updating a non-existent entry', async () => {
		const headers = await getAuthHeaders()
		const response = await app.request('/otp/non-existent-id', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ label: 'New Label' }),
		})
		expect(response.status).toBe(404)
		expect(await response.json()).toEqual({ error: 'OTP entry not found' })
	})

	test('returns 400 when update body is invalid JSON', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ label: 'Test', secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }),
		})
		const { id } = (await createResponse.json()) as { id: string }

		const response = await app.request(`/otp/${id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: 'not valid json{',
		})
		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Invalid JSON body' })
	})

	test('partial update changes only the specified field', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Original Label',
				issuer: 'Original Issuer',
				issuer_second: 'Original Second',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})
		const { id } = (await createResponse.json()) as { id: string }

		const updateResponse = await app.request(`/otp/${id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ label: 'Updated Label' }),
		})
		expect(updateResponse.status).toBe(200)
		expect(await updateResponse.json()).toEqual({ success: true })

		const stored = getEntryById(id)
		expect(stored?.label).toBe('Updated Label')
		expect(stored?.issuer).toBe('Original Issuer')
		expect(stored?.issuer_second).toBe('Original Second')
		expect(stored?.secret).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
	})

	test('empty update body leaves entry unchanged', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Stable Label',
				issuer: 'Stable Issuer',
				issuer_second: 'Stable Second',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})
		const { id } = (await createResponse.json()) as { id: string }

		const updateResponse = await app.request(`/otp/${id}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({}),
		})
		expect(updateResponse.status).toBe(200)
		expect(await updateResponse.json()).toEqual({ success: true })

		const stored = getEntryById(id)
		expect(stored?.label).toBe('Stable Label')
		expect(stored?.issuer).toBe('Stable Issuer')
		expect(stored?.issuer_second).toBe('Stable Second')
		expect(stored?.secret).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
	})
})
