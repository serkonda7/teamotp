import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const entries = sqliteTable('entries', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	issuer: text('issuer').notNull(),
	issuer_second: text('issuer_second').notNull().default(''),
	secret: text('secret').notNull(),
	algorithm: text('algorithm').notNull(),
	digits: integer('digits').notNull(),
	period: integer('period').notNull(),
	archived_at: text('archived_at'),
})

export const tags = sqliteTable('tags', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	color: text('color').notNull(),
})

export const entry_tags = sqliteTable(
	'entry_tags',
	{
		entry_id: text('entry_id')
			.notNull()
			.references(() => entries.id, { onDelete: 'cascade' }),
		tag_id: text('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
	},
	(t) => [primaryKey({ columns: [t.entry_id, t.tag_id] })],
)

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	password_hash: text('password_hash'),
	provider: text('provider').notNull().default('local'),
	provider_id: text('provider_id').unique(),
})

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		created_at: integer('created_at').notNull(),
		last_seen_at: integer('last_seen_at').notNull(),
		expires_at: integer('expires_at').notNull(),
	},
	(table) => [index('sessions_expires_at_idx').on(table.expires_at)],
)

export const auth_states = sqliteTable(
	'auth_states',
	{
		state: text('state').primaryKey(),
		verifier: text('verifier').notNull(),
		expires_at: integer('expires_at').notNull(),
	},
	(table) => [index('auth_states_expires_at_idx').on(table.expires_at)],
)

export const access_log = sqliteTable(
	'access_log',
	{
		id: text('id').primaryKey(),
		user_id: text('user_id').notNull(),
		user_email: text('user_email').notNull(),
		action: text('action').notNull(),
		entry_id: text('entry_id'),
		created_at: integer('created_at').notNull(),
	},
	(table) => [index('access_log_created_at_idx').on(table.created_at)],
)
