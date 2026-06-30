import fs from 'node:fs'
import path from 'node:path'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { $, JSON5 } from 'bun'
import type { ReleaseMetadata } from 'shared/src/types'
import type { UpdateDeps } from './core'

export function createBunUpdateDeps(rootDir: string): UpdateDeps {
	const serverDataDir = path.join(rootDir, 'server', 'data')
	const backupRoot = path.join(rootDir, 'backups')
	const metadataPath = path.join(serverDataDir, 'metadata.json5')

	$.cwd(rootDir)

	return {
		async requireCommand(cmd: string): Promise<void> {
			if (!Bun.which(cmd)) {
				throw new Error(`Missing required command: ${cmd}`)
			}
		},

		async getWorktreeStatus(): Promise<string> {
			return (await $`git status --porcelain`.text()).trim()
		},

		async getCurrentRef(): Promise<string> {
			return (await $`git describe --tags --always --dirty`.text()).trim()
		},

		async getLatestTag(): Promise<string | null> {
			const tags = await $`git tag --sort=-v:refname`.text()
			const latest = tags
				.split('\n')
				.map((tag) => tag.trim())
				.find((tag) => tag.length > 0)
			return latest ?? null
		},

		async getTagReleaseDate(tag: string): Promise<string> {
			try {
				const date =
					await $`git for-each-ref --format="%(creatordate:short)" refs/tags/${tag}`.text()
				const trimmed = date.trim()
				return trimmed.length > 0 ? trimmed : 'unknown date'
			} catch {
				return 'unknown date'
			}
		},

		async fetchRefs(): Promise<void> {
			await $`git fetch --all --tags --prune`.quiet()
		},

		async confirmUpdate(currentRef: string, targetRef: string): Promise<boolean> {
			const rl = createInterface({ input: stdin, output: stdout })
			try {
				const answer = (
					await rl.question(
						`Proceed with update from ${currentRef} to ${targetRef}? [y/N] `,
					)
				)
					.trim()
					.toLowerCase()
				return answer === 'y' || answer === 'yes'
			} finally {
				rl.close()
			}
		},

		async stopApp(): Promise<void> {
			await $`docker compose down`.quiet()
		},

		async createBackup(backupName: string): Promise<void> {
			const backupDir = path.join(backupRoot, backupName)
			fs.mkdirSync(backupDir, { recursive: true })

			await fs.promises.cp(serverDataDir, backupDir, {
				recursive: true,
				force: false,
			})
		},

		async checkoutRef(ref: string): Promise<void> {
			await $`git checkout ${ref}`.quiet()
		},

		async installDependencies(): Promise<void> {
			await $`bun install --frozen-lockfile`.quiet()
		},

		async writeReleaseMetadata(releaseRef: string, releaseDate: string): Promise<void> {
			let text = '{}'
			if (fs.existsSync(metadataPath)) {
				text = fs.readFileSync(metadataPath, 'utf8')
			}

			const metadata = JSON5.parse(text) as ReleaseMetadata
			metadata.releaseRef = releaseRef
			metadata.releaseDate = releaseDate
			metadata.updatedAt = new Date().toISOString()

			const output = JSON5.stringify(metadata, null, 2) ?? '{}'
			fs.writeFileSync(metadataPath, output, 'utf8')
		},

		async startApp(): Promise<void> {
			await $`docker compose up -d --build --remove-orphans`.quiet()
		},

		async printContainerStatus(): Promise<void> {
			await $`docker compose ps`
		},

		log(message: string): void {
			console.log(message)
		},

		now(): Date {
			return new Date()
		},
	}
}
