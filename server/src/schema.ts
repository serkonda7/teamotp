import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const entries = sqliteTable('entries', {
	id: text('id').primaryKey(),
	label: text('label').notNull(),
	issuer: text('issuer').notNull(),
	secret: text('secret').notNull(),
	algorithm: text('algorithm').notNull(),
	digits: integer('digits').notNull(),
	period: integer('period').notNull(),
})

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	password_hash: text('password_hash').notNull(),
})
