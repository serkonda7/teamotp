import { int, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const entries_table = sqliteTable('entries', {
	id: int().primaryKey({ autoIncrement: true }),
	label: text().notNull(),
	issuer: text().notNull(),
	secret: text().notNull(),
	algorithm: text().notNull(),
	digits: int().notNull(),
	period: int().notNull(),
})
