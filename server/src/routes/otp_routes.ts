import { Result } from 'better-result'
import type { Context } from 'hono'
import type { NewOtpEntry } from 'shared/src/types'
import { createEntry, getEntryById, listEntries, updateEntry } from '../db'
import { generateTotpCode } from '../otp'
import type { UpdateOtpEntry } from '../types'

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

// POST /api/otp — create a new entry, return its id
export async function handleCreateOtp(c: Context): Promise<Response> {
	let body: NewOtpEntry
	try {
		body = await c.req.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	// TODO server-side validation of fields
	if (!body.label || !body.secret) {
		return badRequest('Fields "label" and "secret" are required')
	}

	const entry = createEntry(body)
	return json({ id: entry.id }, 201)
}

// GET /api/otp/:id — get the current TOTP code for an entry
export async function handleGetOtpCode(c: Context): Promise<Response> {
	const id = c.req.param('id')
	if (!id) {
		return badRequest('Missing OTP entry id')
	}

	const entry = getEntryById(id)
	if (!entry) {
		return json({ error: 'OTP entry not found' }, 404)
	}

	const code_res = generateTotpCode(entry)
	if (Result.isError(code_res)) {
		return json({ error: code_res.error.message }, 500)
	}
	return json({ code: Result.unwrap(code_res) })
}

// POST /api/otp/:id — update an existing entry
export async function handleUpdateOtp(c: Context): Promise<Response> {
	const id = c.req.param('id')
	if (!id) {
		return badRequest('Missing OTP entry id')
	}

	const entry = getEntryById(id)
	if (!entry) {
		return json({ error: 'OTP entry not found' }, 404)
	}

	let body: UpdateOtpEntry
	try {
		body = await c.req.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	updateEntry(id, body)
	return json({ success: true })
}
