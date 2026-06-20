import { sign } from 'hono/jwt'
import { JWT_ALGO, type JwtPayload } from '../middleware/auth'
import { createSessionId } from '../sessions'

const TEST_SECRET = 'test_secret'

/** Creates JWT and auth cookie for tests. */
export async function createAuthCookie(
	payloadOverrides: Partial<JwtPayload> = {},
): Promise<string> {
	const now = Math.floor(Date.now() / 1000)
	const payload: JwtPayload = {
		sub: 'test@example.com',
		jti: createSessionId(),
		iat: now,
		exp: now + 60 * 60, // 1 hour expiration
		...payloadOverrides,
	}

	const token = await sign(payload, TEST_SECRET, JWT_ALGO)
	return `auth_token=${token}`
}

/** Returns authentication header for tests. */
export async function getAuthHeaders(
	payloadOverrides: Partial<JwtPayload> = {},
): Promise<{ cookie: string }> {
	const cookie = await createAuthCookie(payloadOverrides)
	return { cookie }
}
