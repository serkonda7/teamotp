import fs from 'node:fs'
import { Result } from 'better-result'
import * as v from 'valibot'

/**
 * Schema definition of config file structure and fields.
 */
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

export type AppConfig = v.InferOutput<typeof configSchema>

/**
 * Loads and validates the configuration file from given path.
 */
export function load_config_file(path: string): Result<AppConfig, Error> {
	if (!fs.existsSync(path)) {
		return Result.err(new Error(`Configuration file missing at ${path}`))
	}

	// Parse TOML file content
	const content = fs.readFileSync(path, 'utf8')
	let parsed: object
	try {
		parsed = Bun.TOML.parse(content)
	} catch {
		return Result.err(new Error(`Failed to parse TOML configuration at ${path}`))
	}

	// Validate schema
	const config_res = v.safeParse(configSchema, parsed)
	if (!config_res.success) {
		return Result.err(new Error(`Invalid configuration at ${path}`))
	}

	return Result.ok(config_res.output)
}

// ---------------------------------------------------------------------------
// Getters and setters for global config object.
// ---------------------------------------------------------------------------

let config: AppConfig | null = null

export function initConfig(value: AppConfig): void {
	config = value
}

export function getConfig(): AppConfig {
	if (!config) {
		throw new Error('Config has not been initialized')
	}

	return config
}

// Use special testing config if tests import server modules without running the full server.
if (Bun.env.NODE_ENV === 'test') {
	// Note: config is hardcoded for simplicity.
	// Schema validation might crash the tests if the config becomes invalid.
	const test_config = v.parse(configSchema, {
		auth: {
			jwtSecret: 'test_secret',
		},
	})
	initConfig(test_config)
}
