import { afterEach, beforeEach, describe, expect, setSystemTime, test } from 'bun:test'
import { SESSION_ABSOLUTE_TIMEOUT_S, SESSION_IDLE_TIMEOUT_S } from 'shared/src/session'
import {
	createSessionId,
	invalidateSession,
	isValidSession,
	sweepExpiredSessions,
	touchSession,
} from './sessions'

/** Moves the clock forward by the given seconds, relative to the current fake or real time. */
function advance(seconds: number): void {
	setSystemTime(new Date(Date.now() + seconds * 1000))
}

afterEach(() => {
	setSystemTime() // back to the real clock
})

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

describe('Session timeout', () => {
	test('session stays valid right before the idle timeout', () => {
		const sid = createSessionId()

		advance(SESSION_IDLE_TIMEOUT_S - 60)
		expect(isValidSession(sid)).toBe(true)
	})

	test('session expires after the idle timeout', () => {
		const sid = createSessionId()

		advance(SESSION_IDLE_TIMEOUT_S)
		expect(isValidSession(sid)).toBe(false)
	})

	test('activity extends the idle window', () => {
		const sid = createSessionId()

		// Two nearly full idle windows in a row, with activity in between
		advance(SESSION_IDLE_TIMEOUT_S - 60)
		touchSession(sid)
		advance(SESSION_IDLE_TIMEOUT_S - 60)

		expect(isValidSession(sid)).toBe(true)
	})

	test('activity does not extend the absolute lifetime', () => {
		const sid = createSessionId()

		// Stay active the whole time: touch once per idle window until the cap is passed
		const step = SESSION_IDLE_TIMEOUT_S - 60
		for (let elapsed = 0; elapsed < SESSION_ABSOLUTE_TIMEOUT_S; elapsed += step) {
			advance(step)
			touchSession(sid)
		}

		expect(isValidSession(sid)).toBe(false)
	})

	test('touching an expired session does not revive it', () => {
		const sid = createSessionId()

		advance(SESSION_IDLE_TIMEOUT_S)
		touchSession(sid)

		expect(isValidSession(sid)).toBe(false)
	})
})

describe('Session sweep', () => {
	beforeEach(() => {
		// The store is module state shared by all tests in this file.
		// Drop sessions left over from earlier tests, so the returned count is exact.
		advance(SESSION_ABSOLUTE_TIMEOUT_S)
		sweepExpiredSessions()
		setSystemTime()
	})

	test('removes only timed out sessions', () => {
		const old_sid = createSessionId()

		advance(SESSION_IDLE_TIMEOUT_S)
		const fresh_sid = createSessionId()

		expect(sweepExpiredSessions()).toBe(1)
		expect(isValidSession(old_sid)).toBe(false)
		expect(isValidSession(fresh_sid)).toBe(true)
	})

	test('removes nothing while all sessions are active', () => {
		createSessionId()
		expect(sweepExpiredSessions()).toBe(0)
	})
})
