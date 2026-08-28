import { vValidator } from '@hono/valibot-validator'
import { Result } from 'better-result'
import { Hono } from 'hono'
import { NewOtpEntrySchema, UpdateOtpEntrySchema } from 'shared/src/schemas'
import { logAccess } from '../audit'
import {
	archiveEntry,
	assignTag,
	createEntry,
	getEntryById,
	getTagById,
	listEntries,
	listEntryTags,
	unassignTag,
	updateEntry,
} from '../db'
import { authMiddleware } from '../middleware/auth'
import { onValidationError } from '../middleware/validation'
import { generateTotpCode } from '../otp'

export const otpApp = new Hono()
	.use(authMiddleware)

	// GET /otp — list all entries
	.get('/', (c) => {
		const includeArchived = c.req.query('includeArchived') === 'true'
		return c.json(listEntries(includeArchived))
	})

	// POST /otp — create a new entry, return its id
	.post('/', vValidator('json', NewOtpEntrySchema, onValidationError), (c) => {
		const entry_res = createEntry(c.req.valid('json'))
		if (Result.isError(entry_res)) {
			return c.json({ error: entry_res.error.message }, 400)
		}

		const entry = Result.unwrap(entry_res)
		logAccess(c, 'entry.create', entry.id)
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
		const code = Result.unwrap(code_res)
		logAccess(c, 'code.reveal', id)
		return c.json({ code })
	})

	// POST /otp/:id — update an existing entry
	.post('/:id', vValidator('json', UpdateOtpEntrySchema, onValidationError), (c) => {
		const id = c.req.param('id')

		const entry = getEntryById(id)
		if (!entry) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}

		updateEntry(id, c.req.valid('json'))
		logAccess(c, 'entry.update', id)
		return c.json({ success: true })
	})

	// POST /otp/:id/archive — archive an existing entry
	.post('/:id/archive', (c) => {
		const id = c.req.param('id')
		const archivedAt = archiveEntry(id)
		if (!archivedAt) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}

		logAccess(c, 'entry.archive', id)
		return c.json({ archivedAt })
	})

	// GET /otp/:id/tags — list tags assigned to an entry
	.get('/:id/tags', (c) => {
		const id = c.req.param('id')
		if (!getEntryById(id)) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}

		return c.json(listEntryTags(id))
	})

	// PUT /otp/:id/tags/:tagId — assign a tag to an entry
	.put('/:id/tags/:tagId', (c) => {
		const id = c.req.param('id')
		const tagId = c.req.param('tagId')

		if (!getEntryById(id)) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}
		if (!getTagById(tagId)) {
			return c.json({ error: 'Tag not found' }, 404)
		}

		assignTag(id, tagId)
		return c.json({ success: true })
	})

	// DELETE /otp/:id/tags/:tagId — unassign a tag from an entry
	.delete('/:id/tags/:tagId', (c) => {
		const id = c.req.param('id')
		const tagId = c.req.param('tagId')

		if (!getEntryById(id)) {
			return c.json({ error: 'OTP entry not found' }, 404)
		}
		if (!getTagById(tagId)) {
			return c.json({ error: 'Tag not found' }, 404)
		}

		unassignTag(id, tagId)
		return c.json({ success: true })
	})
