# teamotp
## Getting started
```sh
docker compose up
```

## First Run - Creating a User

On first run, create a user with the CLI bundled in the server image:

```sh
# Start server first
docker compose up -d server

# Run bundled CLI inside server container
docker compose exec server ./cli create-user user@example.com mypassword
```

Then start the containers:
```sh
docker compose up
```

To see available CLI commands:
```sh
docker compose exec server ./cli help
```

## Database migrations
The server uses Drizzle ORM with SQLite migrations stored in `server/drizzle/`.

- Update the schema in `server/src/schema.ts`
- Generate a migration with `bun run db:generate`
- Apply migrations with `bun run db:migrate`

The server also runs pending migrations automatically on startup.
