import { describe, expect, test } from 'bun:test'
import { createSessionId, invalidateSession, isValidSession } from './sessions'

describe('Session Store', () => {
	test('returns false for non-existent session IDs', () => {
		expect(isValidSession('non-existent')).toBe(false)
	})

	test('successfully invalidates an existing session', () => {
		const sid = createSessionId()
		expect(isValidSession(sid)).toBe(true)

		invalidateSession(sid)
		expect(isValidSession(sid)).toBe(false)
	})
})
