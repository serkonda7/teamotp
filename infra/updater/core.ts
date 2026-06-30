export interface UpdateDeps {
	requireCommand(cmd: string): Promise<void>
	getWorktreeStatus(): Promise<string>
	getCurrentRef(): Promise<string>
	getLatestTag(): Promise<string | null>
	getTagReleaseDate(tag: string): Promise<string>
	fetchRefs(): Promise<void>
	confirmUpdate(currentRef: string, targetRef: string): Promise<boolean>
	stopApp(): Promise<void>
	createBackup(backupName: string): Promise<void>
	checkoutRef(ref: string): Promise<void>
	installDependencies(): Promise<void>
	writeReleaseMetadata(releaseRef: string, releaseDate: string): Promise<void>
	startApp(): Promise<void>
	printContainerStatus(): Promise<void>
	log(message: string): void
	now(): Date
}

export interface RunUpdateOptions {
	requestedRef?: string
	isInteractive: boolean
}

export function buildBackupName(now: Date, currentVersion: string): string {
	const datePart = now.toISOString().slice(2, 10).replace(/-/g, '')
	const versionLabel = currentVersion.replace(/^v/, '')
	return `${datePart}_${versionLabel}`
}

async function resolveTargetRef(
	requestedRef: string | undefined,
	deps: Pick<UpdateDeps, 'getLatestTag'>,
): Promise<string> {
	if (requestedRef) {
		return requestedRef
	}

	const latest = await deps.getLatestTag()
	if (!latest) {
		throw new Error('No tags found. Provide --ref <git-ref>.')
	}
	return latest
}

async function assertCleanWorktree(deps: Pick<UpdateDeps, 'getWorktreeStatus'>): Promise<void> {
	const status = await deps.getWorktreeStatus()
	if (status.trim().length > 0) {
		throw new Error('Working tree has uncommitted changes.')
	}
}

export async function runUpdate(options: RunUpdateOptions, deps: UpdateDeps): Promise<void> {
	for (const cmd of ['git', 'docker', 'bun']) {
		await deps.requireCommand(cmd)
	}
	await assertCleanWorktree(deps)
	if (!options.isInteractive) {
		throw new Error('Cannot prompt for confirmation in a non-interactive terminal.')
	}

	const currentRef = await deps.getCurrentRef()
	const currentDate = await deps.getTagReleaseDate(currentRef)

	await deps.fetchRefs()

	const targetRef = await resolveTargetRef(options.requestedRef, deps)
	const targetDate = await deps.getTagReleaseDate(targetRef)

	deps.log(`Current ref: ${currentRef} (${currentDate})`)
	deps.log(`Target ref : ${targetRef} (${targetDate})`)

	const confirmed = await deps.confirmUpdate(currentRef, targetRef)
	if (!confirmed) {
		throw new Error('Aborted by user.')
	}

	deps.log('Stopping app...')
	await deps.stopApp()

	deps.log('Creating backup...')
	const backupName = buildBackupName(deps.now(), currentRef)
	await deps.createBackup(backupName)

	deps.log('Updating...')
	await deps.checkoutRef(targetRef)
	await deps.installDependencies()

	await deps.writeReleaseMetadata(targetRef, targetDate)

	deps.log('Building...')
	await deps.startApp()
	await deps.printContainerStatus()
	deps.log('Done.')
}
