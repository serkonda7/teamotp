/**
 * `data/config.toml` handling
 * - defines supported fields
 * - handles parsing
 * - Exposes a test fallback
 */

import fs from 'node:fs'
import path from 'node:path'
import { SERVER_ROOT } from './util/server_root'

// --------
// Config field definitions (see also config.example.toml)
// --------

export interface MicrosoftAuthConfig {
	clientId: string
	clientSecret: string
	tenantId: string
	redirectUri: string
}

export interface AuthConfig {
	jwtSecret: string
	microsoft?: MicrosoftAuthConfig
}

export interface AppConfig {
	auth: AuthConfig
	frontendUrl?: string
}

// --------
// Config parsing logic
// --------

const is_test_run = Bun.env.NODE_ENV === 'test'

let config: AppConfig

if (is_test_run) {
	config = {
		auth: {
			jwtSecret: 'test_secret',
		},
	}
} else {
	const config_path = path.join(SERVER_ROOT, 'data', 'config.toml')

	if (!fs.existsSync(config_path)) {
		console.error(`FATAL Error: Configuration file missing at ${config_path}`)
		process.exit(1)
	}

	const file_content = fs.readFileSync(config_path, 'utf8')
	try {
		const parsed = Bun.TOML.parse(file_content) as AppConfig
		const auth = parsed.auth
		const rawMicrosoft = (auth as AuthConfig & { microsoft?: Record<string, unknown> })
			.microsoft
		const microsoft = rawMicrosoft
			? {
					clientId: rawMicrosoft.clientId as string,
					clientSecret: rawMicrosoft.clientSecret as string,
					tenantId: rawMicrosoft.tenantId as string,
					redirectUri: rawMicrosoft.redirectUri as string,
				}
			: undefined

		config = {
			auth: {
				jwtSecret: auth.jwtSecret,
				...(microsoft ? { microsoft } : {}),
			},
			...(parsed.frontendUrl ? { frontendUrl: parsed.frontendUrl as string } : {}),
		}
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e)
		console.error(
			`FATAL Error: Failed to parse TOML configuration at ${config_path}:`,
			errorMessage,
		)
		process.exit(1)
	}
}

export { config }
