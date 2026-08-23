import fs from 'node:fs'
import { Result } from 'better-result'
import * as v from 'valibot'

/**
 * Schema definition of config file structure and fields.
 */
export const configSchema = v.object({
	auth: v.object({
		// Renamed from `jwtSecret`: this key now backs JWT signing AND (Phase 7)
		// secret encryption, via separate HKDF-derived subkeys (see `keys.ts`).
		appKey: v.optional(v.pipe(v.string(), v.minLength(32))),
		jwtSecret: v.optional(v.string()), // Deprecated alias for `appKey`, removal planned for 0.4.0
		jwtKeyVersion: v.optional(v.number(), 1),
		loginRateLimit: v.optional(
			v.object({
				maxAttempts: v.optional(v.number(), 10),
				windowSeconds: v.optional(v.number(), 300),
			}),
			{},
		),
		secureCookies: v.optional(v.boolean(), true), // Only disable for plain-HTTP local development
		microsoft: v.optional(
			v.object({
				clientId: v.string(),
				clientSecret: v.string(),
				tenantId: v.string(),
				redirectUri: v.string(),
			}),
		),
	}),
	server: v.optional(
		v.object({
			host: v.optional(v.string(), '0.0.0.0'),
			port: v.optional(v.number(), 3000),
		}),
		{},
	),
	frontendUrl: v.optional(v.string()),
})

type RawConfig = v.InferOutput<typeof configSchema>

/** Normalized config shape: exactly one of `appKey` (alias resolved away). */
export type AppConfig = Omit<RawConfig, 'auth'> & {
	auth: Omit<RawConfig['auth'], 'appKey' | 'jwtSecret'> & { appKey: string }
}

/** Formats valibot issues into `field.path: message` pairs, so a misconfigured deployment tells the operator what to fix. */
function format_issues(issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): string {
	return issues
		.map((issue) => {
			const field = issue.path?.map((item) => String(item.key)).join('.') ?? '(root)'
			return `${field}: ${issue.message}`
		})
		.join('; ')
}

/**
 * Loads and validates the configuration file from given path.
 *
 * Accepts the deprecated `auth.jwtSecret` alias for one release: it is used as
 * `auth.appKey` with a warning. Removing the alias is a 0.4.0 item.
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
		return Result.err(
			new Error(`Invalid configuration at ${path}: ${format_issues(config_res.issues)}`),
		)
	}

	const output = structuredClone(config_res.output) as RawConfig
	if (!output.auth.appKey) {
		if (output.auth.jwtSecret) {
			console.warn(
				`Deprecated config key 'auth.jwtSecret' at ${path}: rename it to 'auth.appKey' (alias removal planned for 0.4.0).`,
			)
			output.auth.appKey = output.auth.jwtSecret
		} else {
			return Result.err(
				new Error(
					`Invalid configuration at ${path}: either 'auth.appKey' or its deprecated alias 'auth.jwtSecret' must be set`,
				),
			)
		}
	}
	delete output.auth.jwtSecret

	return Result.ok(output as AppConfig)
}

/**
 * Resolves the listening port.
 *
 * Precedence: `TEAMOTP_PORT` env var overrides `server.port` from the config.
 * The env var cannot be dropped: Playwright starts two API instances sharing
 * one config file, each on its own port.
 */
export function resolve_listen_port(app_config: AppConfig): number {
	const raw = Bun.env.TEAMOTP_PORT?.trim()
	if (raw) {
		const port = Number(raw)
		if (Number.isInteger(port) && port > 0 && port < 65536) {
			return port
		}
	}
	return app_config.server.port
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
