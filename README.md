# teamotp
## Database migrations
The server uses Drizzle ORM with SQLite migrations stored in `server/drizzle/`.

- Update the schema in `server/src/schema.ts`
- Generate a migration with `bun run db:generate`
- Apply migrations with `bun run db:migrate`

The server also runs pending migrations automatically on startup.
