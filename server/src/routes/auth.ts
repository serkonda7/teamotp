import { ConfidentialClientApplication, CryptoProvider } from '@azure/msal-node'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { getConfig } from '../config'
import { db, getUserByEmail, upsertMicrosoftUser } from '../db'
import { authMiddleware } from '../middleware/auth'
import { auth_states } from '../schema'
import { get_signed_jwt, getSessionCookieOpts, invalidateSession } from '../sessions'
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

// ---------------------------------------------------------------------------
// Providers capability endpoint
// ---------------------------------------------------------------------------

authApp.get('/providers', (c) => {
	return c.json({
		local: true,
		microsoft: !!getConfig().auth.microsoft,
	})
})

// Microsoft login – redirect to Microsoft identity platform
// ---------------------------------------------------------------------------

authApp.get('/login/microsoft', async (c) => {
	const config = getConfig()
	const msAuth = config.auth.microsoft

	if (!msAuth) {
		return c.json({ error: 'Microsoft auth not configured' }, 404)
	}
	const crypto = new CryptoProvider()
	const { verifier, challenge } = await crypto.generatePkceCodes()
	const state = crypto.createNewGuid()

	db.insert(auth_states)
		.values({ state, verifier, expires_at: nowSeconds() + AUTH_STATE_TTL_S })
		.run()

	const authCodeUrl = await getMsalClient().getAuthCodeUrl({
		scopes: ['openid', 'profile', 'email'],
		redirectUri: msAuth.redirectUri,
		codeChallenge: challenge,
		codeChallengeMethod: 'S256',
		state,
	})

	setCookie(c, 'ms_auth_state', state, {
		httpOnly: true,
		secure: config.auth.secureCookies,
		sameSite: 'Lax',
		path: '/',
		maxAge: AUTH_STATE_TTL_S,
	})

	return c.redirect(authCodeUrl)
})

// ---------------------------------------------------------------------------
// Microsoft callback – exchange code, issue session JWT, redirect to app
// ---------------------------------------------------------------------------

authApp.get('/callback/microsoft', async (c) => {
	const config = getConfig()
	const msAuth = config.auth.microsoft

	if (!msAuth) {
		return c.json({ error: 'Microsoft auth not configured' }, 404)
	}

	const code = c.req.query('code')
	const state = c.req.query('state')
	const stateCookie = getCookie(c, 'ms_auth_state')

	if (!code || !state || state !== stateCookie) {
		return c.json({ error: 'Invalid or missing state' }, 400)
	}

	const pending = db.select().from(auth_states).where(eq(auth_states.state, state)).get()
	if (!pending || pending.expires_at <= nowSeconds()) {
		return c.json({ error: 'Auth state expired' }, 400)
	}
	db.delete(auth_states).where(eq(auth_states.state, state)).run()

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

	const token = await get_signed_jwt(user)
	setCookie(c, 'auth_token', token, getSessionCookieOpts())

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

	const token = await get_signed_jwt(user)
	setCookie(c, 'auth_token', token, getSessionCookieOpts())

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
