#!/usr/bin/env bun

/**
 * Update a running teamotp instance to a new release.
 *
 * Usage:
 *   bun run infra/updater/main.ts [--ref <git-ref>]
 *
 * Default to latest tag when --ref is omitted.
 */

import path from 'node:path'
import { stdin, stdout } from 'node:process'
import { parseArgs } from 'node:util'
import { createBunUpdateDeps } from './adapters'
import { runUpdate } from './core'

const ROOT_DIR = path.resolve(import.meta.dir, '../..')

const { values: args } = parseArgs({
	args: process.argv.slice(2),
	options: {
		ref: { type: 'string' },
	},
	strict: true,
})

async function main(): Promise<void> {
	const deps = createBunUpdateDeps(ROOT_DIR)
	await runUpdate(
		{
			requestedRef: args.ref,
			isInteractive: stdin.isTTY && stdout.isTTY,
		},
		deps,
	)
}

main().catch((err: unknown) => {
	const msg = err instanceof Error ? err.message : String(err)
	console.error(`error: ${msg}`)
	process.exit(1)
})
