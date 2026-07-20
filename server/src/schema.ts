import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
