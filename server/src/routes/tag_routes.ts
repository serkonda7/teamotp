import { vValidator } from '@hono/valibot-validator'
import { Result } from 'better-result'
import { Hono } from 'hono'
import { NewTagSchema } from 'shared/src/schemas'
import { logAccess } from '../audit'
import { DuplicateTagError } from '../db/errors'
import { createTag, deleteTag, getTagByName, listTags } from '../db/tags'
import { authMiddleware } from '../middleware/auth'
import { onValidationError } from '../middleware/validation'
import { jsonError } from '../util/http'

export const tagApp = new Hono()
	.use(authMiddleware)

	// GET /tags — list all tags with their member counts
	.get('/', (c) => {
		return c.json(listTags())
	})

	// POST /tags — create a new tag, return its id
	.post('/', vValidator('json', NewTagSchema, onValidationError), (c) => {
		const body = c.req.valid('json')
		if (getTagByName(body.name)) {
			return jsonError(c, 'A tag with this name already exists', 409)
		}

		const tagRes = createTag(body)
		if (Result.isError(tagRes)) {
			// Pre-check above is the fast path; the UNIQUE constraint is the
			// source of truth when two requests race with the same name.
			if (tagRes.error instanceof DuplicateTagError) {
				return jsonError(c, 'A tag with this name already exists', 409)
			}
			return jsonError(c, 'Internal server error', 500)
		}

		const tag = Result.unwrap(tagRes)
		logAccess(c, 'tag.create', tag.id)
		return c.json({ id: tag.id }, 201)
	})

	// DELETE /tags/:id — delete a tag and all its assignments
	.delete('/:id', (c) => {
		const id = c.req.param('id')
		if (!deleteTag(id)) {
			return jsonError(c, 'Tag not found', 404)
		}

		logAccess(c, 'tag.delete', id)
		return c.json({ success: true })
	})
