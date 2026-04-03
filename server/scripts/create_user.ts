import { db } from '../src/db'
import { users } from '../src/schema'

async function main() {
	console.log('--- TeamOTP User Creation Script ---')
	
	const args = Bun.argv.slice(2)
	let email = args[0]
	let password = args[1]

	if (!email) {
		email = prompt('Email: ') ?? ''
	}

	if (!password) {
		password = prompt('Password: ') ?? ''
	}

	if (!email || !password) {
		console.error('Error: Email and password are required.')
		process.exit(1)
	}

	try {
		console.log(`Creating user ${email}...`)
		const password_hash = await Bun.password.hash(password)
		const id = Bun.randomUUIDv7()

		db.insert(users).values({
			id,
			email: email.toLowerCase(),
			password_hash,
		}).run()
		
		console.log('Success! User created.')
	} catch (error: any) {
		console.error('Failed to create user:', error.message)
		process.exit(1)
	}
}

main()
