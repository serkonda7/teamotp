import { Result } from 'better-result'
import { Hono } from 'hono'
import type { NewOtpEntry } from 'shared/src/types'
import { createEntry, getEntryById, listEntries, updateEntry } from '../db'
import { authMiddleware } from '../middleware/auth'
import { generateTotpCode } from '../otp'
import type { UpdateOtpEntry } from '../types'

export const otpApp = new Hono()
	.use(authMiddleware)
	// GET /otp — list all entries
	.get('/', (c) => {
		return c.json(listEntries())
	})
	// POST /otp — create a new entry, return its id
	.post('/', async (c) => {
		let body: NewOtpEntry
		try {
			body = await c.req.json()
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400)
		}

		// TODO server-side validation of fields
		if (!body.label || !body.secret) {
			return c.json({ error: 'Fields "label" and "secret" are required' }, 400)
		}

		const entry = createEntry(body)
		return c.json({ id: entry.id }, 201)
	})
	// GET /otp/:id — get the current TOTP code for an entry
	.get('/:id', (c) => {
		const id = c.req.param('id')

		const entry = getEntryById(id)
		if (!entry) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}

		const code_res = generateTotpCode(entry)
		if (Result.isError(code_res)) {
			return c.json({ error: code_res.error.message }, 500)
		}
		return c.json({ code: Result.unwrap(code_res) })
	})
	// POST /otp/:id — update an existing entry
	.post('/:id', async (c) => {
		const id = c.req.param('id')

		const entry = getEntryById(id)
		if (!entry) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}

		let body: UpdateOtpEntry
		try {
			body = await c.req.json()
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400)
		}

		// Prevent crash by empty body
		const hasFields = Object.values(body).some((v) => v !== undefined)
		if (hasFields) {
			updateEntry(id, body)
		}
		return c.json({ success: true })
	})
