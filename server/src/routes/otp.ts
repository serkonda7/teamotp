import { createEntry, listEntries } from '../db'
import type { NewOtpEntry } from '../types'

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status })
}

function badRequest(msg: string): Response {
	return json({ error: msg }, 400)
}

// GET /api/otp — list all entries
export async function handleListOtp(_req: Request): Promise<Response> {
	return json(listEntries())
}

// POST /api/otp — create a new entry
export async function handleCreateOtp(req: Request): Promise<Response> {
	let body: NewOtpEntry
	try {
		body = await req.json()
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
export async function handleGetOtpCode(_req: Request, _id: string): Promise<Response> {
	// TODO

	return json({ error: 'Not implemented' }, 501)
}

// POST /api/otp/:id — update an existing entry
export async function handleUpdateOtp(_req: Request, _id: string): Promise<Response> {
	// TODO

	return json({ error: 'Not implemented' }, 501)
}
