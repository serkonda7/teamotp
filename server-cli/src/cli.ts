import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { Result } from 'better-result'

async function createUserDb(email: string, password: string): Promise<Result<void, Error>> {
	// Import db and users schema only when actually creating user
	const { db } = await import('server/src/db')
	const { users } = await import('server/src/schema')
	const { normalize_email } = await import('server/src/util/email')

	if (!email || !password) {
		return Result.err(new Error('Email and password are required.'))
	}

	try {
		console.log(`Creating user ${email}...`)
		const password_hash = await Bun.password.hash(password)
		const id = Bun.randomUUIDv7()

		db.insert(users)
			.values({
				id,
				email: normalize_email(email),
				password_hash,
			})
			.run()

		console.log('ok')
		return Result.ok(undefined)
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error)
		return Result.err(new Error(`Failed to create user: ${msg}`))
	}
}

async function normalizeEmails(): Promise<Result<void, Error>> {
	const { db, sqliteHandle } = await import('server/src/db')
	const { users } = await import('server/src/schema')
	const { normalize_email } = await import('server/src/util/email')
	const { eq } = await import('drizzle-orm')

	try {
		const allUsers = db.select().from(users).all()

		// Group by normalized email
		const groups = new Map<string, typeof allUsers>()
		for (const user of allUsers) {
			const normalized = normalize_email(user.email)
			const existing = groups.get(normalized)
			if (existing) {
				existing.push(user)
			} else {
				groups.set(normalized, [user])
			}
		}

		// Detect collisions: more than one row maps to same normalized email
		const collisions: Array<{ normalized: string; users: typeof allUsers }> = []
		for (const [normalized, members] of groups) {
			if (members.length > 1) {
				collisions.push({ normalized, users: members })
			}
		}

		if (collisions.length > 0) {
			console.error('Found duplicate emails that collide when normalized (case-insensitive):')
			for (const { normalized, users: members } of collisions) {
				console.error(`  "${normalized}" collides:`)
				for (const u of members) {
					console.error(`    id=${u.id} email="${u.email}" provider=${u.provider} provider_id=${u.provider_id ?? ''}`)
				}
			}
			console.error(
				'Aborting without changes. Resolve duplicates manually (decide which row and provider_id survives) before re-running.',
			)
			return Result.err(new Error(`Found ${collisions.length} colliding email group(s); aborting`))
		}

		// Determine rows that actually need an update
		const toUpdate = allUsers.filter((u) => normalize_email(u.email) !== u.email)

		if (toUpdate.length === 0) {
			console.log('All emails already normalized — nothing to do.')
			return Result.ok(undefined)
		}

		const tx = sqliteHandle.transaction(() => {
			for (const user of toUpdate) {
				const normalized = normalize_email(user.email)
				db.update(users).set({ email: normalized }).where(eq(users.id, user.id)).run()
			}
		})

		tx()

		console.log(`Normalized ${toUpdate.length} email(s).`)
		return Result.ok(undefined)
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error)
		return Result.err(new Error(`Failed to normalize emails: ${msg}`))
	}
}

async function askPassword(): Promise<string> {
	// Create readline interface
	const rl = createInterface({
		input,
		output,
		terminal: true,
	})

	try {
		const password = await rl.question('Password: ')
		return password
	} finally {
		rl.close()
	}
}

function printUsage(): void {
	console.log(`
Usage: cli.bin [command] [options]

Commands:
  create-user <email>    Create a new user (password is prompted interactively)
  normalize-emails       Normalize all user emails to lowercase (trim + lowercase)
  help                   Show this help message
`)
}

async function main(args: string[]): Promise<Result<void, Error>> {
	if (args.length === 0) {
		printUsage()
		return Result.ok(undefined)
	}

	const command = args[0]

	if (command === 'create-user') {
		if (args.length !== 2) {
			return Result.err(new Error('Usage: create-user <email>'))
		}

		// Always collect password interactively to avoid shell history leaks.
		const password = await askPassword()
		if (!password) {
			return Result.err(new Error('Password cannot be empty'))
		}

		return await createUserDb(args[1], password)
	}

	if (command === 'normalize-emails') {
		return await normalizeEmails()
	}

	if (command === 'help' || command === '-h' || command === '--help') {
		printUsage()
		return Result.ok(undefined)
	}

	return Result.err(new Error(`Unknown command: ${command}`))
}

if (import.meta.main) {
	const result = await main(Bun.argv.slice(2))

	if (Result.isError(result)) {
		console.error(`Error: ${result.error.message}`)
		process.exit(1)
	}

	process.exit(0)
}
