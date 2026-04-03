/// <reference types="bun" />

import { beforeAll, describe, expect, test } from 'bun:test'

const API_BASE = 'http://localhost:3000'
const WEB_BASE = 'https://localhost'

async function wait_for_fetch(
	fn: () => Promise<Response>,
	retries = 10,
	delayMs = 2000,
): Promise<Response> {
	let lastError: unknown

	for (let i = 0; i < retries; i++) {
		try {
			const res = await fn()
			// Consider any response (even 401) as success that the server is up
			if (res.status !== 502 && res.status !== 503) {
				return res
			}
			lastError = new Error(`HTTP ${res.status}`)
		} catch (err) {
			lastError = err
		}

		if (i < retries - 1) {
			await new Promise((r) => setTimeout(r, delayMs))
		}
	}

	throw lastError
}

async function fetch_https(url: string): Promise<Response> {
	return await fetch(url, { tls: { rejectUnauthorized: false } })
}

function apiUrl(path: string): string {
	return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function webUrl(path = '/'): string {
	return `${WEB_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

describe('OTP API smoke test', () => {
	beforeAll(async () => {
		const webRes = await wait_for_fetch(() => fetch_https(webUrl('/')))
		expect(webRes.ok).toBe(true)
	})

	test('API responds to auth requests', async () => {
		const loginRes = await fetch(apiUrl('/auth/login'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ email: 'bad' }), // missing pass
		})

		expect(loginRes.status).toBe(400)
	})
})
