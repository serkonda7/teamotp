import { sign } from 'hono/jwt'
import { getDb } from '../db'
import { getSigningKey } from '../keys'
import { JWT_ALGO, type JwtPayload } from '../middleware/auth'
import { users } from '../schema'
import { createSession } from '../sessions'
import { nowSeconds } from '../util/time'

// Opaque fixture id: never compared against generated ids, so its
// UUID version is irrelevant.
const TEST_USER_ID = '00000000-0000-7000-8000-000000000001'

function ensureTestUser(): void {
	getDb()
		.insert(users)
		.values({ id: TEST_USER_ID, email: 'test@example.com', password_hash: null })
		.onConflictDoNothing()
		.run()
}

/** Creates JWT and auth cookie for tests. */
export async function createAuthCookie(
	payloadOverrides: Partial<JwtPayload> = {},
): Promise<string> {
	const now = nowSeconds()
	ensureTestUser()
	const payload: JwtPayload = {
		sub: 'test@example.com',
		jti: createSession(TEST_USER_ID),
		iat: now,
		exp: now + 60 * 60, // 1 hour expiration
		...payloadOverrides,
	}

	const token = await sign(payload, getSigningKey(), JWT_ALGO)
	return `auth_token=${token}`
}

/** Returns authentication header for tests. */
export async function getAuthHeaders(
	payloadOverrides: Partial<JwtPayload> = {},
): Promise<{ cookie: string }> {
	const cookie = await createAuthCookie(payloadOverrides)
	return { cookie }
}
