import { db } from '../../server/src/db'
import { entries, users } from '../../server/src/schema'

const e2e_user_1 = {
	id: 'e2e-user-test-1',
	email: 'e2e@test.com',
	password_hash: await Bun.password.hash('e2e-password'),
	provider: 'local',
}

const e2e_entry_1 = {
	id: 'e2e-entry-1',
	label: 'Short period',
	issuer: 'test',
	issuer_second: '',
	secret: 'IDOLFJO6I3O4FFHE',
	algorithm: 'sha1',
	digits: 6,
	period: 5,
}

async function seedE2eData() {
	// Clear current state so each run starts deterministic.
	db.delete(entries).run()
	db.delete(users).run()

	db.insert(users).values(e2e_user_1).run()

	db.insert(entries).values([e2e_entry_1]).run()
}

await seedE2eData()
