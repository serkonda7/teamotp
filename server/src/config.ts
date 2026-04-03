import fs from 'node:fs'
import path from 'node:path'

export interface AuthConfig {
	jwtSecret: string
	initialAdminEmail?: string
	initialAdminPassword?: string
}

export interface AppConfig {
	auth: AuthConfig
}

const is_test_run = Bun.env.NODE_ENV === 'test'

let config: AppConfig

if (is_test_run) {
	config = {
		auth: {
			jwtSecret: 'test_secret',
		},
	}
} else {
	const server_dir = path.join(import.meta.dir, '..')
	const config_path = path.join(server_dir, 'config.toml')

	if (!fs.existsSync(config_path)) {
		console.error(`FATAL Error: Configuration file missing at ${config_path}`)
		console.error('Please copy config.example.toml to config.toml and configure your secrets.')
		process.exit(1)
	}

	const file_content = fs.readFileSync(config_path, 'utf8')
	try {
		const parsed = Bun.TOML.parse(file_content) as AppConfig

		config = {
			auth: {
				jwtSecret: parsed.auth.jwtSecret,
				initialAdminEmail: parsed.auth.initialAdminEmail,
				initialAdminPassword: parsed.auth.initialAdminPassword,
			},
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
