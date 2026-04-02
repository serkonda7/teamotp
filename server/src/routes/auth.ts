import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import {
	buildAuthorizationUrl,
	createSessionToken,
	exchangeCodeForTokens,
	generatePkcePair,
	getAuthConfig,
	verifyIdToken,
	verifySessionToken,
} from '../auth'

export const SESSION_COOKIE = 'teamotp_session'
const STATE_COOKIE = 'teamotp_oauth_state'
const VERIFIER_COOKIE = 'teamotp_pkce'

function isSecure(): boolean {
	return Bun.env.NODE_ENV === 'production'
}

const transientCookieOpts = {
	httpOnly: true,
	sameSite: 'Lax' as const,
	path: '/',
	maxAge: 600,
}

// GET /auth/login — redirect to Microsoft's auth page
export async function handleLogin(c: Context): Promise<Response> {
	const config = getAuthConfig()
	if (!config) {
		return c.redirect('/')
	}

	const state = crypto.randomUUID()
	const { verifier, challenge } = await generatePkcePair()

	setCookie(c, STATE_COOKIE, state, { ...transientCookieOpts, secure: isSecure() })
	setCookie(c, VERIFIER_COOKIE, verifier, { ...transientCookieOpts, secure: isSecure() })

	return c.redirect(buildAuthorizationUrl(config, state, challenge))
}

// GET /auth/callback — handle the redirect back from Microsoft
export async function handleCallback(c: Context): Promise<Response> {
	const config = getAuthConfig()
	if (!config) {
		return c.redirect('/')
	}

	const { code, state, error } = c.req.query()

	if (error) {
		return c.text(`Authentication error: ${error}`, 400)
	}

	const savedState = getCookie(c, STATE_COOKIE)
	const codeVerifier = getCookie(c, VERIFIER_COOKIE)

	if (!code || !state || state !== savedState || !codeVerifier) {
		return c.text('Invalid OAuth state or missing parameters', 400)
	}

	deleteCookie(c, STATE_COOKIE)
	deleteCookie(c, VERIFIER_COOKIE)

	try {
		const tokens = await exchangeCodeForTokens(config, code, codeVerifier)
		const user = await verifyIdToken(config, tokens.id_token)
		const sessionToken = await createSessionToken(user, config.sessionSecret)

		setCookie(c, SESSION_COOKIE, sessionToken, {
			httpOnly: true,
			sameSite: 'Lax',
			path: '/',
			secure: isSecure(),
			maxAge: 8 * 60 * 60,
		})

		return c.redirect('/')
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Authentication failed'
		return c.text(msg, 500)
	}
}

// POST /auth/logout — clear session and redirect to Microsoft logout
export async function handleLogout(c: Context): Promise<Response> {
	const config = getAuthConfig()
	deleteCookie(c, SESSION_COOKIE)

	if (!config) {
		return c.redirect('/')
	}

	const postLogoutUri = config.redirectUri.replace('/auth/callback', '/')
	const logoutUrl = new URL(
		`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/logout`,
	)
	logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutUri)
	return c.redirect(logoutUrl.toString())
}

// GET /auth/me — return current session user or 401
export async function handleMe(c: Context): Promise<Response> {
	const config = getAuthConfig()
	if (!config) {
		// Auth disabled — report as authenticated with no user info
		return c.json({ authenticated: true, user: null })
	}

	const token = getCookie(c, SESSION_COOKIE)
	if (!token) {
		return c.json({ authenticated: false }, 401)
	}

	try {
		const user = await verifySessionToken(token, config.sessionSecret)
		return c.json({ authenticated: true, user })
	} catch {
		return c.json({ authenticated: false }, 401)
	}
}
