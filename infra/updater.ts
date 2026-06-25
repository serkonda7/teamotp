#!/usr/bin/env bun

/**
 * Update a running teamotp instance to a new release.
 *
 * Usage:
 *   bun run infra/updater.ts [--ref <git-ref>]
 *
 * Default to latest tag when --ref is omitted.
 */

import fs from 'node:fs'
import path from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { $ } from 'bun'

// --------
// Constants
// --------

const ROOT_DIR = path.resolve(import.meta.dir, '..')
const SERVER_DATA_DIR = path.join(ROOT_DIR, 'server', 'data')
const BACKUP_ROOT = path.join(ROOT_DIR, 'backups')

// --------
// CLI
// --------

$.cwd(ROOT_DIR)

const { values: args } = parseArgs({
	args: process.argv.slice(2),
	options: {
		ref: { type: 'string' },
	},
	strict: true,
})

// --------
// Helpers
// --------

function fatal(msg: string): never {
	console.error(`error: ${msg}`)
	process.exit(1)
}

// --------
// Pre-flight checks
// --------

async function assert_command_available(cmd: string): Promise<void> {
	const cmd_path = Bun.which(cmd)
	if (!cmd_path) {
		fatal(`Missing required command: ${cmd}`)
	}
}

async function require_commands(cmds: string[]): Promise<void> {
	for (const cmd of cmds) {
		await assert_command_available(cmd)
	}
}

async function assert_clean_worktree(): Promise<void> {
	const status = await $`git status --porcelain`.text()
	if (status.trim().length > 0) {
		fatal('Working tree has uncommitted changes.')
	}
}

// --------
// Core functions
// --------

async function resolve_ref(ref: string | undefined): Promise<string> {
	if (ref) {
		return ref
	}

	const tags = await $`git tag --sort=-v:refname`.text()
	const latest = tags.split('\n').find((t) => t.trim().length > 0)
	if (!latest) {
		fatal('No tags found. Provide --ref <git-ref>.')
	}
	return latest.trim()
}

async function get_current_ref(): Promise<string> {
	const resolved = await $`git describe --tags --always --dirty`.text()
	return resolved.trim()
}

async function get_tag_release_date(tag: string): Promise<string> {
	try {
		const date =
			await $`git for-each-ref --format="%(creatordate:short)" refs/tags/${tag}`.text()
		const trimmed = date.trim()
		return trimmed.length > 0 ? trimmed : 'unknown date'
	} catch {
		return 'unknown date'
	}
}

async function ask_confirm(current_ref: string, target_ref: string): Promise<void> {
	if (!stdin.isTTY || !stdout.isTTY) {
		fatal('Cannot prompt for confirmation in a non-interactive terminal.')
	}

	const rl = createInterface({ input: stdin, output: stdout })
	try {
		const answer = (
			await rl.question(`Proceed with update from ${current_ref} to ${target_ref}? [y/N] `)
		)
			.trim()
			.toLowerCase()

		if (answer !== 'y' && answer !== 'yes') {
			fatal('Aborted by user.')
		}
	} finally {
		rl.close()
	}
}

async function create_backup(current_version: string): Promise<void> {
	const datePart = new Date()
		.toISOString()
		.slice(2, 10) // "YY-MM-DD"
		.replace(/-/g, '') // "YYMMDD"
	const label = current_version.replace(/^v/, '')
	const backupDir = path.join(BACKUP_ROOT, `${datePart}_${label}`)

	fs.mkdirSync(backupDir, { recursive: true })

	await fs.promises.cp(SERVER_DATA_DIR, backupDir, {
		recursive: true,
		force: false, // Safety: don't overwrite existing backup
	})
}

// --------
// Main
// --------

async function main(): Promise<void> {
	// pre-flight checks
	await require_commands(['git', 'docker', 'bun'])
	await assert_clean_worktree()

	// Fetch latest refs (tags) and dates
	const current_ref = await get_current_ref()
	const current_date = await get_tag_release_date(current_ref)
	await $`git fetch --all --tags --prune`.quiet()
	const target_ref = await resolve_ref(args.ref)
	const target_date = await get_tag_release_date(target_ref)

	console.log(`Current ref: ${current_ref} (${current_date})`)
	console.log(`Target ref : ${target_ref} (${target_date})`)

	await ask_confirm(current_ref, target_ref)

	// Stop containers for data consistency
	console.log('Stopping app...')
	await $`docker compose down`.quiet()

	// Backup current data
	console.log('Creating backup...')
	await create_backup(current_ref)

	// Get new version
	console.log('Updating...')
	await $`git checkout ${target_ref}`.quiet()
	await $`bun install --frozen-lockfile`.quiet()

	console.log('Building...')
	await $`docker compose up -d --build --remove-orphans`.quiet()
	await $`docker compose ps`
	console.log('Done.')
}

main().catch((err: unknown) => {
	const msg = err instanceof Error ? err.message : String(err)
	fatal(msg)
})
