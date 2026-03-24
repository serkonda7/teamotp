import { createEntry, getEntry, listEntries, updateEntry } from '../store'
import { generateTotp, secondsRemaining } from '../totp'
import type { CreateOtpEntryDto, UpdateOtpEntryDto } from '../types'

function json(data: unknown, status = 200): Response {
	return Response.json(data, { status })
}

function notFound(msg = 'Not found'): Response {
	return json({ error: msg }, 404)
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
	let body: CreateOtpEntryDto
	try {
		body = await req.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	if (!body.name || !body.secret) {
		return badRequest('Fields "name" and "secret" are required')
	}

	const entry = createEntry(body)
	return json(entry, 201)
}

// GET /api/otp/:id — get the current TOTP code for an entry
export async function handleGetOtpCode(_req: Request, id: string): Promise<Response> {
	const entry = getEntry(id)
	if (!entry) return notFound(`No entry with id "${id}"`)

	return json({
		id: entry.id,
		name: entry.name,
		issuer: entry.issuer,
		code: generateTotp(entry.secret),
		secondsRemaining: secondsRemaining(),
	})
}

// POST /api/otp/:id — update an existing entry
export async function handleUpdateOtp(req: Request, id: string): Promise<Response> {
	const existing = getEntry(id)
	if (!existing) return notFound(`No entry with id "${id}"`)

	let body: UpdateOtpEntryDto
	try {
		body = await req.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	const updated = updateEntry(id, body)
	return json(updated)
}
