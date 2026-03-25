import type { Context } from 'hono'
import type { NewOtpEntry } from '../../../shared/src/types'
import { createEntry, listEntries } from '../db'

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status })
}

function badRequest(msg: string): Response {
	return json({ error: msg }, 400)
}

// GET /api/otp — list all entries
export async function handleListOtp(_c: Context): Promise<Response> {
	return json(listEntries())
}

// POST /api/otp — create a new entry
export async function handleCreateOtp(c: Context): Promise<Response> {
	let body: NewOtpEntry
	try {
		body = await c.req.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	if (!body.label || !body.secret) {
		return badRequest('Fields "name" and "secret" are required')
	}

	const entry = createEntry(body)
	return json(entry, 201)
}

// GET /api/otp/:id — get the current TOTP code for an entry
export async function handleGetOtpCode(_c: Context): Promise<Response> {
	// TODO

	return json({ error: 'Not implemented' }, 501)
}

// POST /api/otp/:id — update an existing entry
export async function handleUpdateOtp(_c: Context): Promise<Response> {
	// TODO

	return json({ error: 'Not implemented' }, 501)
}
