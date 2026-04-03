import fs from 'node:fs'
import path from 'node:path'

/**
 * Robustly find the server's root directory.
 * Checks the current working directory first, then looks in a 'server' subdirectory.
 */
export function findServerDir(): string {
	const cwd = process.cwd()
	// Marker files to identify the server root
	const markers = ['drizzle', 'config.toml']

	const isServerRoot = (dir: string) => markers.some((m) => fs.existsSync(path.join(dir, m)))

	if (isServerRoot(cwd)) {
		return cwd
	}

	const serverPath = path.join(cwd, 'server')
	if (isServerRoot(serverPath)) {
		return serverPath
	}

	return cwd
}
