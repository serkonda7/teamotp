import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'

export interface AuthConfig {
	clientId: string
	clientSecret: string
	tenantId: string
	redirectUri: string
	sessionSecret: Uint8Array
}

export interface SessionUser {
	oid: string
	email: string
	name: string
}

let _config: AuthConfig | null | undefined

/**
 * Returns the auth config loaded from environment variables, or null if auth
 * is not configured (i.e. AZURE_CLIENT_ID is not set). When null, auth is
 * disabled and all API routes are accessible without a session.
 *
 * Required env vars to enable auth:
 *   AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID,
 *   AZURE_REDIRECT_URI, SESSION_SECRET
 */
export function getAuthConfig(): AuthConfig | null {
	if (_config !== undefined) {
		return _config
	}

	const clientId = Bun.env.AZURE_CLIENT_ID
	const clientSecret = Bun.env.AZURE_CLIENT_SECRET
	const tenantId = Bun.env.AZURE_TENANT_ID
	const redirectUri = Bun.env.AZURE_REDIRECT_URI
	const sessionSecretStr = Bun.env.SESSION_SECRET

	if (!clientId || !clientSecret || !tenantId || !redirectUri || !sessionSecretStr) {
		_config = null
		return null
	}

	_config = {
		clientId,
		clientSecret,
		tenantId,
		redirectUri,
		sessionSecret: new TextEncoder().encode(sessionSecretStr),
	}
	return _config
}

export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
	const random = crypto.getRandomValues(new Uint8Array(32))
	const verifier = btoa(String.fromCharCode(...random))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')

	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
	const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')

	return { verifier, challenge }
}

export function buildAuthorizationUrl(
	config: AuthConfig,
	state: string,
	codeChallenge: string,
): string {
	const params = new URLSearchParams({
		client_id: config.clientId,
		response_type: 'code',
		redirect_uri: config.redirectUri,
		scope: 'openid profile email',
		state,
		code_challenge: codeChallenge,
		code_challenge_method: 'S256',
	})
	return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?${params}`
}

export async function exchangeCodeForTokens(
	config: AuthConfig,
	code: string,
	codeVerifier: string,
): Promise<{ id_token: string }> {
	const response = await fetch(
		`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: config.clientId,
				client_secret: config.clientSecret,
				code,
				redirect_uri: config.redirectUri,
				grant_type: 'authorization_code',
				code_verifier: codeVerifier,
			}),
		},
	)

	if (!response.ok) {
		throw new Error(`Token exchange failed: ${await response.text()}`)
	}
	return response.json()
}

export async function verifyIdToken(config: AuthConfig, idToken: string): Promise<SessionUser> {
	const JWKS = createRemoteJWKSet(
		new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`),
	)

	const { payload } = await jwtVerify(idToken, JWKS, {
		issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
		audience: config.clientId,
	})

	return {
		oid: payload.oid as string,
		email: (payload.email ?? (payload as Record<string, unknown>).preferred_username) as string,
		name: payload.name as string,
	}
}

export async function createSessionToken(user: SessionUser, secret: Uint8Array): Promise<string> {
	return new SignJWT({ oid: user.oid, email: user.email, name: user.name })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('8h')
		.sign(secret)
}

export async function verifySessionToken(token: string, secret: Uint8Array): Promise<SessionUser> {
	const { payload } = await jwtVerify(token, secret)
	return payload as unknown as SessionUser
}
