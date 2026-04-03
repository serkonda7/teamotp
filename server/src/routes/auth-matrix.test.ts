import { describe, expect, test } from 'bun:test'
import { sign } from 'hono/jwt'
import { app } from '../index'

import { createSessionId } from '../sessions'

const TEST_SECRET = 'test_secret'

enum Role {
	unauthenticated,
	authenticated,
}

// Access profiles
const RESTRICTED = [Role.authenticated]

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface Endpoint {
	method: HttpMethod
	path: string
	acceptedRoles: Role[]
}

// Endpoint authentication matrix
// login and logout are not tested
const endpoints: Endpoint[] = [
	{ method: 'GET', path: '/auth/me', acceptedRoles: RESTRICTED },
	{ method: 'GET', path: '/otp', acceptedRoles: RESTRICTED },
	{ method: 'POST', path: '/otp', acceptedRoles: RESTRICTED },
	{ method: 'GET', path: '/otp/test-id', acceptedRoles: RESTRICTED },
	{ method: 'POST', path: '/otp/test-id', acceptedRoles: RESTRICTED },
]

async function getAuthCookie(role: Role): Promise<string | undefined> {
	if (role === Role.unauthenticated) {
		return undefined
	}

	const sid = createSessionId()
	const token = await sign(
		{ sub: 'test_user_id', email: 'test@example.com', sid },
		TEST_SECRET,
		'HS256',
	)

	return `auth_token=${token}`
}

function testEndpointAccess(endpoint: Endpoint, role: Role, cookie?: string) {
	const isAccepted = endpoint.acceptedRoles.includes(role)

	test(`${endpoint.method} ${endpoint.path} -> ${isAccepted ? 'Allowed' : '401'}`, async () => {
		const headers: Record<string, string> = {}
		if (cookie) {
			headers.Cookie = cookie
		}

		const response = await app.request(endpoint.path, {
			method: endpoint.method,
			headers,
		})

		if (isAccepted) {
			expect(response.status).not.toBe(401)
		} else {
			expect(response.status).toBe(401)
		}
	})
}

const roleCookies = new Map<Role, string | undefined>()
for (const role of [Role.unauthenticated, Role.authenticated]) {
	roleCookies.set(role, await getAuthCookie(role))
}

describe('Auth Matrix', () => {
	for (const role of [Role.unauthenticated, Role.authenticated]) {
		const cookie = roleCookies.get(role)

		describe(`Role: ${Role[role]}`, () => {
			for (const endpoint of endpoints) {
				testEndpointAccess(endpoint, role, cookie)
			}
		})
	}
})
