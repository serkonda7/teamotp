import { Hono } from 'hono'
import type { NewTag } from 'shared/src/types'
import { createTag, deleteTag, getTagByName, listTags } from '../db'
import { authMiddleware } from '../middleware/auth'

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/

export const tagApp = new Hono()
	.use(authMiddleware)

	// GET /tags — list all tags with their member counts
	.get('/', (c) => {
		return c.json(listTags())
	})

	// POST /tags — create a new tag, return its id
	.post('/', async (c) => {
		let body: NewTag
		try {
			body = await c.req.json()
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400)
		}

		if (!body || typeof body !== 'object') {
			return c.json({ error: 'Invalid JSON body' }, 400)
		}

		const name = body.name?.trim() ?? ''
		const color = body.color ?? ''
		if (!name || !color) {
			return c.json({ error: 'Fields "name" and "color" are required' }, 400)
		}
		if (!HEX_COLOR_PATTERN.test(color)) {
			return c.json({ error: 'Field "color" must be a hex color like #1a2b3c' }, 400)
		}
		if (getTagByName(name)) {
			return c.json({ error: 'A tag with this name already exists' }, 409)
		}

		const tag = createTag({ name, color })
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
