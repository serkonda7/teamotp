import type { Context } from 'hono'
import { generate } from 'otplib'
import type { HashAlgorithm } from 'otplib'
import type { NewOtpEntry } from '../../../shared/src/types'
import { createEntry, getEntryById, listEntries } from '../db'

function getHashAlgorithm(algorithm: string): HashAlgorithm {
	switch (algorithm.toUpperCase()) {
		case 'SHA1':
			return 'sha1'
		case 'SHA256':
			return 'sha256'
		case 'SHA512':
			return 'sha512'
		default:
			throw new Error(`Unsupported algorithm: ${algorithm}`)
	}
}

async function generateTotpCode(secret: string, algorithm: string, digits: number, period: number): Promise<string> {
	return await generate({
		secret,
		algorithm: getHashAlgorithm(algorithm),
		digits,
		period,
		strategy: 'totp',
	})
}

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
export async function handleGetOtpCode(c: Context): Promise<Response> {
	const id = c.req.param('id')
	if (!id) {
		return badRequest('Missing OTP entry id')
	}

	const entry = getEntryById(id)
	if (!entry) {
		return json({ error: 'OTP entry not found' }, 404)
	}

	try {
		const code = await generateTotpCode(entry.secret, entry.algorithm, entry.digits, entry.period)
		return json({ code })
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to generate OTP code'
		return json({ error: message }, 400)
	}
}

// POST /api/otp/:id — update an existing entry
export async function handleUpdateOtp(_c: Context): Promise<Response> {
	// TODO

	return json({ error: 'Not implemented' }, 501)
}
