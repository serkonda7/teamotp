/**
 * `data/config.toml` handling
 * - Schema definition and validation
 * - Expose a test fallback
 */

import fs from 'node:fs'
import path from 'node:path'
import { Result } from 'better-result'
import * as v from 'valibot'
import { SERVER_ROOT } from './util/server_root'

// --------
// Config Schema
// --------

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

// --------
// Config parsing logic
// --------

export function loadConfig(): Result<AppConfig, Error> {
	const is_test_run = Bun.env.NODE_ENV === 'test'

	if (is_test_run) {
		const testConfigResult = v.safeParse(configSchema, {
			auth: {
				jwtSecret: 'test_secret',
			},
		})

		if (!testConfigResult.success) {
			return Result.err(new Error('Invalid built-in test configuration'))
		}

		return Result.ok(testConfigResult.output)
	}

	const config_path = path.join(SERVER_ROOT, 'data', 'config.toml')

	if (!fs.existsSync(config_path)) {
		return Result.err(new Error(`Configuration file missing at ${config_path}`))
	}

	const file_content = fs.readFileSync(config_path, 'utf8')
	let parsed: object
	try {
		parsed = Bun.TOML.parse(file_content)
	} catch {
		return Result.err(new Error(`Failed to parse TOML configuration at ${config_path}`))
	}

	const parsedConfigResult = v.safeParse(configSchema, parsed)
	if (!parsedConfigResult.success) {
		return Result.err(new Error(`Invalid configuration at ${config_path}`))
	}

	return Result.ok(parsedConfigResult.output)
}

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

// Keep tests simple when they import server modules without running index.ts.
if (Bun.env.NODE_ENV === 'test') {
	const configResult = loadConfig()
	if (Result.isOk(configResult)) {
		initConfig(configResult.value)
	}
}
