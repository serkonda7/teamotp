# teamotp
## Getting started
```sh
# Run
docker compose up

# Update or initial install
docker compose up --build
```


### Admin activities
```sh
# Manually create user (password prompted interactively)
docker compose exec server ./cli.bin create-user user@example.com
bun server-cli/src/cli.ts create-user user@user.de
```


## Development
### Database migrations
The server uses Drizzle ORM with SQLite migrations stored in `server/drizzle/`.
Pending migrations run automatically on startup.

#### Generate migrations
- Update the schema in `server/src/schema.ts`
- Generate a migration with `bun run db:generate`
