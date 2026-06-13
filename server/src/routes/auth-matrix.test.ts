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
const ALL_ROLES = [Role.unauthenticated, Role.authenticated]

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface Endpoint {
	method: HttpMethod
	path: string
	acceptedRoles: Role[]
}

interface AppRoute {
	method: string
	path: string
}

function endpointKey(endpoint: Pick<Endpoint, 'method' | 'path'>): string {
	return `${endpoint.method} ${endpoint.path}`
}

function isHttpMethod(method: string): method is HttpMethod {
	return method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE'
}

function getAppEndpoints(): Endpoint[] {
	const ignoredRoutes = new Set<string>(['ALL /*'])
	const unique = new Map<string, Endpoint>()

	for (const route of app.routes as AppRoute[]) {
		if (!isHttpMethod(route.method)) {
			continue
		}

		const key = `${route.method} ${route.path}`
		if (ignoredRoutes.has(key)) {
			continue
		}

		unique.set(key, { method: route.method, path: route.path, acceptedRoles: [] })
	}

	return [...unique.values()]
}

// Endpoint authentication matrix
const endpoints: Endpoint[] = [
	{ method: 'GET', path: '/auth/providers', acceptedRoles: ALL_ROLES },
	{ method: 'GET', path: '/auth/login/microsoft', acceptedRoles: ALL_ROLES },
	{ method: 'GET', path: '/auth/callback/microsoft', acceptedRoles: ALL_ROLES },
	{ method: 'POST', path: '/auth/login', acceptedRoles: ALL_ROLES },
	{ method: 'POST', path: '/auth/logout', acceptedRoles: RESTRICTED },
	{ method: 'GET', path: '/auth/me', acceptedRoles: RESTRICTED },
	{ method: 'GET', path: '/otp', acceptedRoles: RESTRICTED },
	{ method: 'POST', path: '/otp', acceptedRoles: RESTRICTED },
	{ method: 'GET', path: '/otp/:id', acceptedRoles: RESTRICTED },
	{ method: 'POST', path: '/otp/:id', acceptedRoles: RESTRICTED },
]

test('Matrix covers all registered endpoints', () => {
	const matrixKeys = new Set(endpoints.map(endpointKey))
	const appEndpointKeys = new Set(getAppEndpoints().map(endpointKey))

	const missingInMatrix = [...appEndpointKeys].filter((key) => !matrixKeys.has(key)).sort()
	const missingInApp = [...matrixKeys].filter((key) => !appEndpointKeys.has(key)).sort()

	expect(missingInMatrix).toEqual([])
	expect(missingInApp).toEqual([])
})

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

function testEndpointAccess(endpoint: Endpoint, role: Role) {
	const isAccepted = endpoint.acceptedRoles.includes(role)

	test(`${endpoint.method} ${endpoint.path} -> ${isAccepted ? 'Allowed' : '401'}`, async () => {
		const cookie = await getAuthCookie(role)
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

describe('Auth Matrix', () => {
	for (const role of ALL_ROLES) {
		describe(`Role: ${Role[role]}`, () => {
			for (const endpoint of endpoints) {
				testEndpointAccess(endpoint, role)
			}
		})
	}
})
