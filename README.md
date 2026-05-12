# teamotp
## Getting started
```sh
docker compose up
```


### Admin activities
```sh
# Manually create user (password prompted interactively)
docker compose exec server ./cli.bin create-user user@example.com
bun server-cli/src/cli.ts create-user user@user.de
```


## Database migrations
The server uses Drizzle ORM with SQLite migrations stored in `server/drizzle/`.

- Update the schema in `server/src/schema.ts`
- Generate a migration with `bun run db:generate`
- Apply migrations with `bun run db:migrate`

The server also runs pending migrations automatically on startup.
