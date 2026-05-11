async function createUserDb(email: string, password: string): Promise<void> {
	// Import db and users schema only when actually creating user
	const { db } = await import('server/src/db')
	const { users } = await import('server/src/schema')

	if (!email || !password) {
		console.error('Error: Email and password are required.')
		process.exit(1)
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
		process.exit(0)
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error)
		console.error('✗ Failed to create user:', msg)
		process.exit(1)
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

async function main(args: string[]): Promise<void> {
	if (args.length === 0) {
		printUsage()
		process.exit(0)
	}

	const command = args[0]

	if (command === 'create-user') {
		if (args.length < 3) {
			console.error('Error: create-user requires email and password arguments')
			printUsage()
			process.exit(1)
		}
		await createUserDb(args[1], args[2])
		return
	}

	if (command === 'help' || command === '-h' || command === '--help') {
		printUsage()
		process.exit(0)
	}

	console.error(`Unknown command: ${command}`)
	printUsage()
	process.exit(1)
}

if (import.meta.main) {
	main(Bun.argv.slice(2))
}
