import { vValidator } from '@hono/valibot-validator'
import { Hono } from 'hono'
import { NewTagSchema } from 'shared/src/schemas'
import { createTag, deleteTag, getTagByName, listTags } from '../db'
import { authMiddleware } from '../middleware/auth'
import { onValidationError } from '../middleware/validation'

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
			return c.json({ error: 'A tag with this name already exists' }, 409)
		}

		const tag = createTag(body)
		return c.json({ id: tag.id }, 201)
	})

	// DELETE /tags/:id — delete a tag and all its assignments
	.delete('/:id', (c) => {
		const id = c.req.param('id')
		if (!deleteTag(id)) {
			return c.json({ error: 'Tag not found' }, 404)
		}

		return c.json({ success: true })
	})
