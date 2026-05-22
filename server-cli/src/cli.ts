import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { Result } from 'better-result'

async function createUserDb(email: string, password: string): Promise<Result<void, Error>> {
	// Import db and users schema only when actually creating user
	const { db } = await import('server/src/db')
	const { users } = await import('server/src/schema')

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
				email: email.toLowerCase(),
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
