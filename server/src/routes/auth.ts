import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { config } from '../config'
import { getUserByEmail, upsertMicrosoftUser } from '../db'
import { authMiddleware } from '../middleware/auth'
import { get_signed_jwt, invalidateSession, SESSION_COOKIE_OPTS } from '../sessions'

export const authApp = new Hono()

// ---------------------------------------------------------------------------
// Microsoft / MSAL helpers
// ---------------------------------------------------------------------------

let _msalClient: ConfidentialClientApplication | null = null

function getMsalClient(): ConfidentialClientApplication {
	if (!_msalClient) {
		const ms = config.auth.microsoft
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

// In-memory store for pending auth state: state → { verifier, expiresAt }
const pendingStates = new Map<string, { verifier: string; expiresAt: number }>()

function cleanExpiredStates() {
	const now = Date.now()
	for (const [key, val] of pendingStates) {
		if (val.expiresAt < now) {
			pendingStates.delete(key)
		}
	}
}

// ---------------------------------------------------------------------------
// Providers capability endpoint
// ---------------------------------------------------------------------------

authApp.get('/providers', (c) => {
	return c.json({
		local: true,
		microsoft: !!config.auth.microsoft,
	})
})

// ---------------------------------------------------------------------------
// Microsoft login – redirect to Microsoft identity platform
// ---------------------------------------------------------------------------

authApp.get('/login/microsoft', async (c) => {
	if (!config.auth.microsoft) {
		return c.json({ error: 'Microsoft auth not configured' }, 404)
	}
	cleanExpiredStates()

	const crypto = new CryptoProvider()
	const { verifier, challenge } = await crypto.generatePkceCodes()
	const state = crypto.createNewGuid()

	pendingStates.set(state, { verifier, expiresAt: Date.now() + 10 * 60 * 1000 })

	const authCodeUrl = await getMsalClient().getAuthCodeUrl({
		scopes: ['openid', 'profile', 'email'],
		redirectUri: config.auth.microsoft.redirectUri,
		codeChallenge: challenge,
		codeChallengeMethod: 'S256',
		state,
	})

	setCookie(c, 'ms_auth_state', state, {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'Lax',
		path: '/',
		maxAge: 600,
	})

	return c.redirect(authCodeUrl)
})

// ---------------------------------------------------------------------------
// Microsoft callback – exchange code, issue session JWT, redirect to app
// ---------------------------------------------------------------------------

authApp.get('/callback/microsoft', async (c) => {
	if (!config.auth.microsoft) {
		return c.json({ error: 'Microsoft auth not configured' }, 404)
	}

	const code = c.req.query('code')
	const state = c.req.query('state')
	const stateCookie = getCookie(c, 'ms_auth_state')

	if (!code || !state || state !== stateCookie) {
		return c.json({ error: 'Invalid or missing state' }, 400)
	}

	const pending = pendingStates.get(state)
	if (!pending || pending.expiresAt < Date.now()) {
		return c.json({ error: 'Auth state expired' }, 400)
	}
	pendingStates.delete(state)

	let tokenResponse: Awaited<ReturnType<ConfidentialClientApplication['acquireTokenByCode']>>
	try {
		tokenResponse = await getMsalClient().acquireTokenByCode({
			code,
			scopes: ['openid', 'profile', 'email'],
			redirectUri: config.auth.microsoft.redirectUri,
			codeVerifier: pending.verifier,
		})
	} catch (err) {
		console.error('MSAL token exchange failed:', err)
		return c.json({ error: 'Token exchange failed' }, 502)
	}

	if (!tokenResponse) {
		return c.json({ error: 'No token response' }, 502)
	}

	const claims = tokenResponse.idTokenClaims as {
		oid?: string
		preferred_username?: string
		email?: string
	}
	const oid = claims.oid
	const email = claims.preferred_username ?? claims.email

	if (!oid || !email) {
		return c.json({ error: 'Missing required claims in id_token' }, 502)
	}

	const user = upsertMicrosoftUser({ providerId: oid, email })

	const token = await get_signed_jwt(user.email)
	setCookie(c, 'auth_token', token, SESSION_COOKIE_OPTS)

	deleteCookie(c, 'ms_auth_state', { path: '/' })

	return c.redirect(config.frontendUrl ?? '/')
})

authApp.post('/login', async (c) => {
	const body = await c.req.json().catch(() => null)
	if (!body?.email || !body.password) {
		return c.json({ error: 'Email and password are required' }, 400)
	}

	const user = getUserByEmail(body.email)
	if (!user) {
		return c.json({ error: 'Invalid email or password' }, 401)
	}

	if (!user.password_hash) {
		return c.json({ error: 'Invalid email or password' }, 401)
	}

	const isMatch = await Bun.password.verify(body.password, user.password_hash)
	if (!isMatch) {
		return c.json({ error: 'Invalid email or password' }, 401)
	}

	const token = await get_signed_jwt(user.email)
	setCookie(c, 'auth_token', token, SESSION_COOKIE_OPTS)

	return c.json({ success: true })
})

authApp.post('/logout', authMiddleware, async (c) => {
	const payload = c.get('jwtPayload')
	invalidateSession(payload.jti)

	deleteCookie(c, 'auth_token', {
		path: '/',
	})
	return c.json({ success: true })
})

authApp.get('/me', authMiddleware, (c) => {
	const payload = c.get('jwtPayload')
	return c.json({ email: payload.sub })
})
