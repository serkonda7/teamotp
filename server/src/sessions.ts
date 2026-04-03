const activeSessionIds = new Set<string>()

/**
 * Creates a unique session identifier, adds it to the allowlist, and returns it.
 */
export function createSessionId(): string {
	const sid = crypto.randomUUID()
	activeSessionIds.add(sid)
	return sid
}

/**
 * Checks if a session ID is currently present in the allowlist.
 */
export function isValidSession(sid: string): boolean {
	return activeSessionIds.has(sid)
}

/**
 * Removes a session ID from the allowlist, effectively logging out the session.
 */
export function invalidateSession(sid: string): void {
	activeSessionIds.delete(sid)
}
