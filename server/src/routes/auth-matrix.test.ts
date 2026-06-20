// SPDX-FileCopyrightText: 2026-present Lukas Neubert
// SPDX-License-Identifier: MPL-2.0

/**
 * Test file to ensure the correct authentication is required for each endpoint.
 * Contains two main tests:
 * - Matrix completeness: Ensures all registered endpoints are covered by the matrix
 * - Access control: Tests each endpoint with all defined roles / access profiles
 */

import { describe, expect, test } from 'bun:test'
import { app } from '../index'
import { createAuthCookie } from '../tests/helpers'

//
// Constants and types
//

const ACCEPTED_CODES = [200, 302, 400, 404]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

interface Endpoint {
	method: HttpMethod
	path: string
	acceptedRoles: Role[]
}

//
// Roles, access profiles and endpoints
//

enum Role {
	unauthenticated,
	authenticated,
}

const ALL_ROLES: Role[] = [Role.unauthenticated, Role.authenticated]
const AUTHENTICATED: Role[] = [Role.authenticated]

// Endpoint authentication matrix
const endpoints: Endpoint[] = [
	{ method: 'GET', path: '/auth/providers', acceptedRoles: ALL_ROLES },
	{ method: 'GET', path: '/auth/login/microsoft', acceptedRoles: ALL_ROLES },
	{ method: 'GET', path: '/auth/callback/microsoft', acceptedRoles: ALL_ROLES },
	{ method: 'POST', path: '/auth/login', acceptedRoles: ALL_ROLES },
	{ method: 'POST', path: '/auth/logout', acceptedRoles: AUTHENTICATED },
	{ method: 'GET', path: '/auth/me', acceptedRoles: AUTHENTICATED },
	{ method: 'GET', path: '/otp', acceptedRoles: AUTHENTICATED },
	{ method: 'POST', path: '/otp', acceptedRoles: AUTHENTICATED },
	{ method: 'GET', path: '/otp/:id', acceptedRoles: AUTHENTICATED },
	{ method: 'POST', path: '/otp/:id', acceptedRoles: AUTHENTICATED },
]

//
// 1. Test matrix completeness
//

type HttpMethod = (typeof HTTP_METHODS)[number]

interface AppRoute {
	method: string
	path: string
}

function endpointKey(endpoint: Pick<Endpoint, 'method' | 'path'>): string {
	return `${endpoint.method} ${endpoint.path}`
}

function isHttpMethod(method: string): method is HttpMethod {
	return (HTTP_METHODS as readonly string[]).includes(method)
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

test('Matrix covers all registered endpoints', () => {
	const matrixKeys = new Set(endpoints.map(endpointKey))
	const appEndpointKeys = new Set(getAppEndpoints().map(endpointKey))

	const missingInMatrix = [...appEndpointKeys].filter((key) => !matrixKeys.has(key)).sort()
	const missingInApp = [...matrixKeys].filter((key) => !appEndpointKeys.has(key)).sort()

	expect(missingInMatrix).toEqual([])
	expect(missingInApp).toEqual([])
})

//
// 2. Test access control
//

async function getAuthCookie(role: Role): Promise<string | undefined> {
	if (role === Role.unauthenticated) {
		return undefined
	}

	return createAuthCookie()
}

function testEndpointAccess(endpoint: Endpoint, role: Role): void {
	const isAccepted = endpoint.acceptedRoles.includes(role)

	test(`${endpoint.method} ${endpoint.path} -> ${isAccepted ? 'ok' : '401'}`, async () => {
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
			expect(response.status).toBeOneOf(ACCEPTED_CODES)
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
