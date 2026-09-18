import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node'
import { vValidator } from '@hono/valibot-validator'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { LoginSchema } from 'shared/src/schemas'
import { logLoginAttempt } from '../audit'
import { getConfig } from '../config'
import { consumeAuthState, createAuthState, getUserByEmail, upsertMicrosoftUser } from '../db/users'
import { authMiddleware } from '../middleware/auth'
import { rate_limit } from '../middleware/rate_limit'
import { onValidationError } from '../middleware/validation'
import {
	get_signed_jwt,
	getSessionCookieOpts,
	getStateCookieOpts,
	invalidateSession,
} from '../sessions'
import { jsonError } from '../util/http'
import { nowSeconds } from '../util/time'

export const authApp = new Hono()

const AUTH_STATE_TTL_S = 10 * 60

// ---------------------------------------------------------------------------
// Microsoft / MSAL helpers
// ---------------------------------------------------------------------------

let _msalClient: ConfidentialClientApplication | null = null

function getMsalClient(): ConfidentialClientApplication {
	if (!_msalClient) {
		const ms = getConfig().auth.microsoft
		if (!ms) {
			throw new Error('Microsoft auth is not configured')
		}
		_msalClient = new ConfidentialClientApplication({
			auth: {
				clientId: ms.clientId,
				clientSecret: ms.clientSecret,
				authority: `https://login.microsoftonline.com/${ms.tenantId}`,
			},
		})
	}
	return _msalClient
}

function withErrorParam(base: string, error: string): string {
	try {
		const url = new URL(base)
		url.searchParams.set('error', error)
		return url.toString()
	} catch {
		const sep = base.includes('?') ? '&' : '?'
		return `${base}${sep}error=${error}`
	}
}

// ---------------------------------------------------------------------------
// Providers capability endpoint
// ---------------------------------------------------------------------------

authApp.get('/providers', (c) => {
	return c.json({
		local: !getConfig().auth.disableLocalLogin,
		microsoft: !!getConfig().auth.microsoft,
	})
})

// Microsoft login – redirect to Microsoft identity platform
// ---------------------------------------------------------------------------

authApp.get('/login/microsoft', async (c) => {
	const config = getConfig()
	const msAuth = config.auth.microsoft

	if (!msAuth) {
		return jsonError(c, 'Microsoft auth not configured', 404)
	}
	const crypto = new CryptoProvider()
	const { verifier, challenge } = await crypto.generatePkceCodes()
	const state = crypto.createNewGuid()

	createAuthState(state, verifier, nowSeconds() + AUTH_STATE_TTL_S)

	const authCodeUrl = await getMsalClient().getAuthCodeUrl({
		scopes: ['openid', 'profile', 'email'],
		redirectUri: msAuth.redirectUri,
		codeChallenge: challenge,
		codeChallengeMethod: 'S256',
		state,
	})

	setCookie(c, 'ms_auth_state', state, getStateCookieOpts(AUTH_STATE_TTL_S))

	return c.redirect(authCodeUrl)
})

// ---------------------------------------------------------------------------
// Microsoft callback – exchange code, issue session JWT, redirect to app
// ---------------------------------------------------------------------------

authApp.get('/callback/microsoft', rate_limit(), async (c) => {
	const config = getConfig()
	const msAuth = config.auth.microsoft

	if (!msAuth) {
		return jsonError(c, 'Microsoft auth not configured', 404)
	}

	const code = c.req.query('code')
	const state = c.req.query('state')
	const stateCookie = getCookie(c, 'ms_auth_state')

	if (!code || !state || state !== stateCookie) {
		logLoginAttempt({ email: 'unknown', action: 'login.failure' })
		return c.redirect(withErrorParam(config.frontendUrl ?? '/', 'invalid_state'))
	}

	const pending = consumeAuthState(state, nowSeconds())
	if (!pending) {
		logLoginAttempt({ email: 'unknown', action: 'login.failure' })
		return c.redirect(withErrorParam(config.frontendUrl ?? '/', 'expired_state'))
	}

	let tokenResponse: Awaited<ReturnType<ConfidentialClientApplication['acquireTokenByCode']>>
	try {
		tokenResponse = await getMsalClient().acquireTokenByCode({
			code,
			scopes: ['openid', 'profile', 'email'],
			redirectUri: msAuth.redirectUri,
			codeVerifier: pending.verifier,
		})
	} catch (err) {
		console.error('MSAL token exchange failed:', err)
		logLoginAttempt({ email: 'unknown', action: 'login.failure' })
		return jsonError(c, 'Token exchange failed', 502)
	}

	if (!tokenResponse) {
		logLoginAttempt({ email: 'unknown', action: 'login.failure' })
		return jsonError(c, 'No token response', 502)
	}

	const claims = tokenResponse.idTokenClaims as {
		oid?: string
		preferred_username?: string
		email?: string
	}
	const oid = claims.oid
	const email = claims.preferred_username ?? claims.email

	if (!oid || !email) {
		logLoginAttempt({ email: email ?? 'unknown', action: 'login.failure' })
		return jsonError(c, 'Missing required claims in id_token', 502)
	}

	const user = upsertMicrosoftUser({ providerId: oid, email })
	logLoginAttempt({ email: user.email, userId: user.id, action: 'login.success' })

	const token = await get_signed_jwt(user)
	setCookie(c, 'auth_token', token, getSessionCookieOpts())

	deleteCookie(c, 'ms_auth_state', {
		path: '/',
		secure: config.auth.secureCookies,
		sameSite: 'Lax',
	})

	return c.redirect(config.frontendUrl ?? '/')
})

authApp.post(
	'/login',
	rate_limit(),
	// Disabled-provider check stays ahead of body validation so a disabled
	// route answers 404 regardless of payload shape.
	async (c, next) => {
		if (getConfig().auth.disableLocalLogin) {
			return jsonError(c, 'Local login is disabled', 404)
		}
		await next()
	},
	vValidator('json', LoginSchema, onValidationError),
	async (c) => {
		const body = c.req.valid('json')

		const user = getUserByEmail(body.email)
		if (!user) {
			logLoginAttempt({ email: body.email, action: 'login.failure' })
			return jsonError(c, 'Invalid email or password', 401)
		}

		if (!user.password_hash) {
			logLoginAttempt({ email: body.email, userId: user.id, action: 'login.failure' })
			return jsonError(c, 'Invalid email or password', 401)
		}

		const isMatch = await Bun.password.verify(body.password, user.password_hash)
		if (!isMatch) {
			logLoginAttempt({ email: body.email, userId: user.id, action: 'login.failure' })
			return jsonError(c, 'Invalid email or password', 401)
		}

		logLoginAttempt({ email: user.email, userId: user.id, action: 'login.success' })
		const token = await get_signed_jwt(user)
		setCookie(c, 'auth_token', token, getSessionCookieOpts())

		return c.json({ success: true })
	},
)

authApp.post('/logout', authMiddleware, async (c) => {
	const payload = c.get('jwtPayload')
	invalidateSession(payload.jti)

	deleteCookie(c, 'auth_token', {
		path: '/',
		secure: getConfig().auth.secureCookies,
		sameSite: 'Strict',
	})
	return c.json({ success: true })
})

authApp.get('/me', authMiddleware, (c) => {
	const payload = c.get('jwtPayload')
	return c.json({ email: payload.sub })
})
