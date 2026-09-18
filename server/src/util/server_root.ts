/**
 * Logic for finding the server root directory to locate data and migration files.
 * This is required as working directory might differ across local development, docker and server-cli.
 */

import fs from 'node:fs'
import path from 'node:path'
import { Result } from 'better-result'

const MARKERS = ['drizzle', 'data']

/**
 * Check if directory contains any marker files
 */
function contains_markers(dir: string): boolean {
	return MARKERS.some((marker) => fs.existsSync(path.join(dir, marker)))
}

/**
 * Find server root directory by looking for marker files.
 */
function find_server_root(): Result<string, Error> {
	// Check working directory
	const cwd = process.cwd()
	if (contains_markers(cwd)) {
		return Result.ok(cwd)
	}

	// Check server subdirectory
	const serverPath = path.join(cwd, 'server')
	if (contains_markers(serverPath)) {
		return Result.ok(serverPath)
	}

	return Result.err(new Error('Server root not found'))
}

export const SERVER_ROOT: string = find_server_root().unwrap()

/**
 * Reads an env var trimmed, treating missing/blank as unset. The three path
 * and port resolutions (`db.ts`, `index.ts`, `config.ts`) all trimmed inline
 * before; they share this now so blank-vs-unset cannot diverge.
 */
export function getTrimmedEnv(name: string): string | undefined {
	const raw = Bun.env[name]?.trim()
	return raw ? raw : undefined
}

/**
 * Resolves a data-dir-relative file env value: absolute paths pass through,
 * anything else is anchored at `<SERVER_ROOT>/data`.
 */
export function resolveInDataDir(configured_path: string): string {
	if (path.isAbsolute(configured_path)) {
		return configured_path
	}
	return path.join(SERVER_ROOT, 'data', configured_path)
}
