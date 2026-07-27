import { db } from '../../server/src/db'
import { entries, entry_tags, tags, users } from '../../server/src/schema'
import type { User } from '../../server/src/types'

const e2e_user_1: User = {
	id: 'e2e-user-test-1',
	email: 'e2e@test.com',
	password_hash: await Bun.password.hash('e2e-password'),
	provider: 'local',
	provider_id: null,
}

const e2e_entries = [
	// Tests visual OTP code change
	{
		id: 'e2e-entry-1',
		label: 'period-5-seconds',
		issuer: 'test',
		issuer_second: '',
		secret: 'IDOLFJO6I3O4FFHE',
		algorithm: 'sha1',
		digits: 6,
		period: 5,
	},
	{
		id: 'e2e-entry-2',
		label: 'ops@example.com',
		issuer: 'GitHub',
		issuer_second: '',
		secret: 'JBSWY3DPEHPK3PXP',
		algorithm: 'sha1',
		digits: 6,
		period: 30,
	},
	// Tests second issuer line and 8 digit codes in the list.
	{
		id: 'e2e-entry-3',
		label: 'root',
		issuer: 'AWS',
		issuer_second: 'Production',
		secret: 'KRSXG5CTMVRXEZLU',
		algorithm: 'sha1',
		digits: 8,
		period: 30,
	},
]

const e2e_tag_1 = {
	id: 'e2e-tag-1',
	name: 'Server',
	color: '#3b82f6',
}

async function seedE2eData(): Promise<void> {
	// Clear current state so each run starts deterministic.
	db.delete(entry_tags).run()
	db.delete(tags).run()
	db.delete(entries).run()
	db.delete(users).run()

	db.insert(users).values(e2e_user_1).run()

	db.insert(entries).values(e2e_entries).run()

	db.insert(tags).values(e2e_tag_1).run()
	db.insert(entry_tags).values({ entry_id: e2e_entries[1].id, tag_id: e2e_tag_1.id }).run()
}

await seedE2eData()
