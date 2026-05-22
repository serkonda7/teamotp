/**
 * `data/config.toml` handling
 * - defines supported fields
 * - handles parsing
 * - Exposes a test fallback
 */

import fs from 'node:fs'
import path from 'node:path'
import * as v from 'valibot'
import { SERVER_ROOT } from './util/server_root'

// --------
// Config field definitions
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

const configSchema = v.object({
	auth: v.object({
		jwtSecret: v.string(),
		microsoft: v.optional(
			v.object({
				clientId: v.string(),
				clientSecret: v.string(),
				tenantId: v.string(),
				redirectUri: v.string(),
			}),
		),
	}),
	frontendUrl: v.optional(v.string()),
})

// --------
// Config parsing logic
// --------

const is_test_run = Bun.env.NODE_ENV === 'test'

let config: AppConfig

if (is_test_run) {
	// Note: test config is hardcoded here for simplicity. Schema validation can just crash if invalid
	config = v.parse(configSchema, {
		auth: {
			jwtSecret: 'test_secret',
		},
	})
} else {
	const config_path = path.join(SERVER_ROOT, 'data', 'config.toml')

	if (!fs.existsSync(config_path)) {
		console.error(`FATAL Error: Configuration file missing at ${config_path}`)
		process.exit(1)
	}

	const file_content = fs.readFileSync(config_path, 'utf8')
	let parsed: object
	try {
		parsed = Bun.TOML.parse(file_content)
	} catch (e: unknown) {
		const errorMessage = e instanceof Error ? e.message : String(e)
		console.error(
			`FATAL Error: Failed to parse TOML configuration at ${config_path}:`,
			errorMessage,
		)
		process.exit(1)
	}

	const result = v.safeParse(configSchema, parsed)
	if (!result.success) {
		console.error(`FATAL Error: Invalid configuration at ${config_path}`)
		console.error(result.issues)
		process.exit(1)
	}

	config = result.output
}

export { config }
