import { beforeEach, describe, expect, test } from 'bun:test'
import { db } from '../db'
import { app } from '../index'
import { entries, entry_tags, tags } from '../schema'
import { getAuthHeaders } from '../tests/helpers'

beforeEach(() => {
	db.delete(entry_tags).run()
	db.delete(tags).run()
	db.delete(entries).run()
})

async function createEntryViaApi(headers: { cookie: string }): Promise<string> {
	const response = await app.request('/otp', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify({ label: 'Entry', secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }),
	})
	const body = (await response.json()) as { id: string }
	return body.id
}

async function createTagViaApi(
	headers: { cookie: string },
	name = 'Work',
	color = '#ff8800',
): Promise<string> {
	const response = await app.request('/tags', {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...headers },
		body: JSON.stringify({ name, color }),
	})
	const body = (await response.json()) as { id: string }
	return body.id
}

describe('Tag routes', () => {
	test('validates required fields in create endpoint', async () => {
		const headers = await getAuthHeaders()
		const response = await app.request('/tags', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ name: 'no-color' }),
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({ error: 'Field "color" is required' })
	})

	test('rejects invalid color format', async () => {
		const headers = await getAuthHeaders()
		const response = await app.request('/tags', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ name: 'Work', color: 'red' }),
		})

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({
			error: 'color: Must be a hex color like #1a2b3c',
		})
	})

	test('creates a tag and lists it with zero members', async () => {
		const headers = await getAuthHeaders()
		const createResponse = await app.request('/tags', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ name: 'Work', color: '#FF8800' }),
		})

		expect(createResponse.status).toBe(201)
		const createBody = (await createResponse.json()) as { id: string }
		expect(createBody.id.length).toBeGreaterThan(0)

		const listResponse = await app.request('/tags', { headers: { ...headers } })
		expect(listResponse.status).toBe(200)
		expect(await listResponse.json()).toEqual([
			{ id: createBody.id, name: 'Work', color: '#ff8800', member_count: 0 },
		])
	})

	test('rejects duplicate tag names with 409', async () => {
		const headers = await getAuthHeaders()
		await createTagViaApi(headers, 'Work')

		const response = await app.request('/tags', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify({ name: 'Work', color: '#00ff00' }),
		})

		expect(response.status).toBe(409)
		expect(await response.json()).toEqual({ error: 'A tag with this name already exists' })
	})

	test('deletes a tag and returns 404 for unknown ids', async () => {
		const headers = await getAuthHeaders()
		const tagId = await createTagViaApi(headers)

		const deleteResponse = await app.request(`/tags/${tagId}`, {
			method: 'DELETE',
			headers: { ...headers },
		})
		expect(deleteResponse.status).toBe(200)
		expect(await deleteResponse.json()).toEqual({ success: true })

		const listResponse = await app.request('/tags', { headers: { ...headers } })
		expect(await listResponse.json()).toEqual([])

		const missingResponse = await app.request(`/tags/${tagId}`, {
			method: 'DELETE',
			headers: { ...headers },
		})
		expect(missingResponse.status).toBe(404)
		expect(await missingResponse.json()).toEqual({ error: 'Tag not found' })
	})

	test('assigns and unassigns a tag, updating member count and entry tags', async () => {
		const headers = await getAuthHeaders()
		const entryId = await createEntryViaApi(headers)
		const tagId = await createTagViaApi(headers)

		const assignResponse = await app.request(`/otp/${entryId}/tags/${tagId}`, {
			method: 'PUT',
			headers: { ...headers },
		})
		expect(assignResponse.status).toBe(200)

		// Assigning twice is idempotent
		const reassignResponse = await app.request(`/otp/${entryId}/tags/${tagId}`, {
			method: 'PUT',
			headers: { ...headers },
		})
		expect(reassignResponse.status).toBe(200)

		const entryTagsResponse = await app.request(`/otp/${entryId}/tags`, {
			headers: { ...headers },
		})
		expect(entryTagsResponse.status).toBe(200)
		expect(await entryTagsResponse.json()).toEqual([
			{ id: tagId, name: 'Work', color: '#ff8800' },
		])

		const listResponse = await app.request('/tags', { headers: { ...headers } })
		expect(await listResponse.json()).toEqual([
			{ id: tagId, name: 'Work', color: '#ff8800', member_count: 1 },
		])

		const entryListResponse = await app.request('/otp', { headers: { ...headers } })
		const entryList = (await entryListResponse.json()) as {
			tags: { id: string; name: string; color: string }[]
		}[]
		expect(entryList[0]?.tags).toEqual([{ id: tagId, name: 'Work', color: '#ff8800' }])

		const unassignResponse = await app.request(`/otp/${entryId}/tags/${tagId}`, {
			method: 'DELETE',
			headers: { ...headers },
		})
		expect(unassignResponse.status).toBe(200)

		const afterListResponse = await app.request('/tags', { headers: { ...headers } })
		expect(await afterListResponse.json()).toEqual([
			{ id: tagId, name: 'Work', color: '#ff8800', member_count: 0 },
		])
	})

	test('deleting a tag removes its assignments', async () => {
		const headers = await getAuthHeaders()
		const entryId = await createEntryViaApi(headers)
		const tagId = await createTagViaApi(headers)

		await app.request(`/otp/${entryId}/tags/${tagId}`, {
			method: 'PUT',
			headers: { ...headers },
		})
		await app.request(`/tags/${tagId}`, { method: 'DELETE', headers: { ...headers } })

		const entryTagsResponse = await app.request(`/otp/${entryId}/tags`, {
			headers: { ...headers },
		})
		expect(await entryTagsResponse.json()).toEqual([])
	})

	test('returns 404 when assigning with unknown entry or tag', async () => {
		const headers = await getAuthHeaders()
		const entryId = await createEntryViaApi(headers)
		const tagId = await createTagViaApi(headers)

		const missingEntry = await app.request(`/otp/missing/tags/${tagId}`, {
			method: 'PUT',
			headers: { ...headers },
		})
		expect(missingEntry.status).toBe(404)
		expect(await missingEntry.json()).toEqual({ error: 'OTP entry not found' })

		const missingTag = await app.request(`/otp/${entryId}/tags/missing`, {
			method: 'PUT',
			headers: { ...headers },
		})
		expect(missingTag.status).toBe(404)
		expect(await missingTag.json()).toEqual({ error: 'Tag not found' })
	})

	test('returns 404 when listing tags of a non-existent entry', async () => {
		const headers = await getAuthHeaders()
		const response = await app.request('/otp/missing/tags', {
			headers: { ...headers },
		})
		expect(response.status).toBe(404)
		expect(await response.json()).toEqual({ error: 'OTP entry not found' })
	})
})
