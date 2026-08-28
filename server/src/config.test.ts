import { afterEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import { Result } from 'better-result'
import { type AppConfig, load_config_file, resolve_listen_port } from './config'

const TMP_DIR = `/tmp/opencode/teamotp-config-test-${process.pid}`

function write_config(content: string): string {
	fs.mkdirSync(TMP_DIR, { recursive: true })
	const path = `${TMP_DIR}/config-${crypto.randomUUID()}.toml`
	fs.writeFileSync(path, content)
	return path
}

function expect_ok(res: Result<AppConfig, Error>): AppConfig {
	if (Result.isError(res)) {
		throw new Error(`expected Ok, got: ${res.error.message}`)
	}
	expect(res).toBeDefined()
	return res.value
}

function expect_err(res: Result<AppConfig, Error>): Error {
	if (!Result.isError(res)) {
		throw new Error('expected Err')
	}
	expect(res).toBeDefined()
	return res.error
}

afterEach(() => {
	delete Bun.env.TEAMOTP_PORT
})

describe('load_config_file', () => {
	test('server.port defaults to 3000 when absent', () => {
		const path = write_config(`
			[auth]
			appKey = "0123456789abcdef0123456789abcdef"
		`)

		const config = expect_ok(load_config_file(path))

		expect(config.server.port).toBe(3000)
	})

	test('TEAMOTP_PORT overrides server.port', () => {
		Bun.env.TEAMOTP_PORT = '4567'
		const path = write_config(`
			[auth]
			appKey = "0123456789abcdef0123456789abcdef"

			[server]
			port = 3000
		`)

		expect(resolve_listen_port(expect_ok(load_config_file(path)))).toBe(4567)
	})

	test('config value is used when TEAMOTP_PORT is unset', () => {
		const path = write_config(`
			[auth]
			appKey = "0123456789abcdef0123456789abcdef"

			[server]
			port = 4321
		`)

		expect(resolve_listen_port(expect_ok(load_config_file(path)))).toBe(4321)
	})

	test('error message includes failing field paths', () => {
		const path = write_config(`
			[auth]
			appKey = "too-short"
		`)

		const error = expect_err(load_config_file(path))

		expect(error.message).toContain('auth.appKey')
	})

	test('missing appKey → error naming auth.appKey', () => {
		const path = write_config(`
			[auth]
			secureCookies = false
		`)

		const error = expect_err(load_config_file(path))

		expect(error.message).toContain('auth.appKey')
	})
})
