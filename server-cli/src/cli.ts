import { err, ok, type Result } from '@serkonda7/ts-result'

async function createUserDb(email: string, password: string): Promise<Result<void>> {
	// Import db and users schema only when actually creating user
	const { db } = await import('server/src/db')
	const { users } = await import('server/src/schema')

	if (!email || !password) {
		return err(new Error('Email and password are required.'))
	}

	try {
		console.log(`Creating user ${email}...`)
		const password_hash = await Bun.password.hash(password)
		const id = Bun.randomUUIDv7()

		db.insert(users)
			.values({
				id,
				email: email.toLowerCase(),
				password_hash,
			})
			.run()

		console.log('ok')
		return ok(undefined)
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error)
		return err(new Error(`Failed to create user: ${msg}`))
	}
}

function printUsage(): void {
	console.log(`
Usage: cli [command] [options]

Commands:
  create-user <email> <password>    Create a new user
  help                              Show this help message

Examples:
	cli create-user user@example.com mypassword
`)
}

async function main(args: string[]): Promise<Result<void>> {
	if (args.length === 0) {
		printUsage()
		return ok(undefined)
	}

	const command = args[0]

	if (command === 'create-user') {
		if (args.length < 3) {
			return err(new Error('create-user requires email and password arguments'))
		}

		return await createUserDb(args[1], args[2])
	}

	if (command === 'help' || command === '-h' || command === '--help') {
		printUsage()
		return ok(undefined)
	}

	return err(new Error(`Unknown command: ${command}`))
}

if (import.meta.main) {
	const result = await main(Bun.argv.slice(2))

	if (result.error) {
		console.error(`Error: ${result.error.message}`)
		process.exit(1)
	}

	process.exit(0)
}
