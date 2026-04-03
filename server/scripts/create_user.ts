import { db } from '../src/db'
import { users } from '../src/schema'

async function main() {
	const email = prompt('Email: ') ?? ''
	const password = prompt('Password: ') ?? ''

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
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error)
		console.error('Failed to create user:', msg)
		process.exit(1)
	}
}

main()
