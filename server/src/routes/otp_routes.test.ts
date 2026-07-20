import { beforeEach, describe, expect, test } from 'bun:test'
import { db, getEntryById } from '../db'
import { app } from '../index'
import { entries } from '../schema'
import { getAuthHeaders } from '../tests/helpers'

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
				tags: [],
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

	test('archives an entry and returns archivedAt', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Archive me',
				issuer: 'archive.example',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})
		const { id } = (await createResponse.json()) as { id: string }

		const archiveResponse = await app.request(`/otp/${id}/archive`, {
			method: 'POST',
			headers: { ...headers },
		})

		expect(archiveResponse.status).toBe(200)
		const archiveBody = (await archiveResponse.json()) as { archivedAt: string }
		expect(archiveBody.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

		const stored = getEntryById(id)
		expect(stored?.archived_at).toBe(archiveBody.archivedAt)
	})

	test('archived entries are hidden by default and can be included explicitly', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/otp', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({
				label: 'Hidden when archived',
				issuer: 'archive.example',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})
		const { id } = (await createResponse.json()) as { id: string }

		await app.request(`/otp/${id}/archive`, {
			method: 'POST',
			headers: { ...headers },
		})

		const defaultList = await app.request('/otp', {
			headers: { ...headers },
		})
		expect(defaultList.status).toBe(200)
		expect(await defaultList.json()).toEqual([])

		const includeArchivedList = await app.request('/otp?includeArchived=true', {
			headers: { ...headers },
		})
		expect(includeArchivedList.status).toBe(200)
		expect(await includeArchivedList.json()).toEqual([
			{
				id,
				label: 'Hidden when archived',
				issuer: 'archive.example',
				issuer_second: '',
				period: 30,
				tags: [],
			},
		])
	})

	test('returns 404 when archiving a non-existent entry', async () => {
		const headers = await getAuthHeaders()
		const archiveResponse = await app.request('/otp/missing/archive', {
			method: 'POST',
			headers: { ...headers },
		})

		expect(archiveResponse.status).toBe(404)
		expect(await archiveResponse.json()).toEqual({ error: 'OTP entry not found' })
	})
})
