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
