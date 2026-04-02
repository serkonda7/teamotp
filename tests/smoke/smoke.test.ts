/// <reference types="bun" />

import { beforeAll, describe, expect, test } from 'bun:test'

const API_BASE = process.env.SMOKE_API_BASE_URL ?? 'http://localhost:3000'
const WEB_BASE = process.env.SMOKE_WEB_BASE_URL ?? 'https://localhost'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

function apiUrl(path: string): string {
	return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function webUrl(path = '/'): string {
	return `${WEB_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

type CreateOtpResponse = { id: string }
type GetOtpCodeResponse = { code: string }

describe('OTP API smoke test', () => {
	beforeAll(async () => {
		const webRes = await fetch(webUrl('/'))
		expect(webRes.ok).toBe(true)

		const apiRes = await fetch(apiUrl('/otp'))
		expect(apiRes.ok).toBe(true)
	})

	test('creates an entry and returns a 6-digit TOTP code', async () => {
		const createRes = await fetch(apiUrl('/otp'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				label: 'CI Smoke',
				secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
			}),
		})

		expect(createRes.status).toBe(201)

		const createBody = (await createRes.json()) as CreateOtpResponse
		expect(typeof createBody.id).toBe('string')
		expect(createBody.id.length).toBeGreaterThan(0)

		const codeRes = await fetch(apiUrl(`/otp/${createBody.id}`))
		expect(codeRes.status).toBe(200)

		const codeBody = (await codeRes.json()) as GetOtpCodeResponse
		expect(typeof codeBody.code).toBe('string')
		expect(codeBody.code).toMatch(/^[0-9]{6}$/)
	})
})
