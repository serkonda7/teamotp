import { beforeEach, describe, expect, test } from 'bun:test'
import { Result } from 'better-result'
import type { UpdateOtpEntry } from 'shared/src/schemas'
import { createEntry, db, getEntryById, updateEntry } from './db'
import { entries } from './schema'

beforeEach(() => {
	db.delete(entries).run()
})

describe('createEntry', () => {
	test('rejects a secret that cannot generate a code and stores nothing', () => {
		// Base32-shaped, but otplib cannot decode it
		const result = createEntry({ label: 'Undecodable', secret: 'JBSWY3DPEHPK3PXPJ' })

		expect(Result.isError(result)).toBe(true)
		expect(db.select().from(entries).all()).toEqual([])
	})
})

describe('updateEntry', () => {
	// The route validator already rejects these fields. This asserts the data
	// layer refuses them on its own, for callers that never pass through a route.
	test('ignores fields outside the update whitelist', () => {
		const entry = Result.unwrap(
			createEntry({
				label: 'Original',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
				digits: 8,
			}),
		)

		updateEntry(entry.id, {
			label: 'Renamed',
			secret: 'EVIL',
			digits: 6,
			archived_at: '2020-01-01T00:00:00.000Z',
			id: 'hijacked',
		} as UpdateOtpEntry)

		const stored = getEntryById(entry.id)
		expect(stored?.label).toBe('Renamed')
		expect(stored?.secret).toBe('JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP')
		expect(stored?.digits).toBe(8)
		expect(stored?.archived_at).toBeNull()
		expect(getEntryById('hijacked')).toBeNull()
	})

	test('leaves the row untouched when no updatable field is given', () => {
		const entry = Result.unwrap(
			createEntry({ label: 'Stable', secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' }),
		)

		updateEntry(entry.id, {})

		expect(getEntryById(entry.id)?.label).toBe('Stable')
	})
})
