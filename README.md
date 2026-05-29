# teamotp
## Scanning QR codes
For desktop, we recommend this Chrome extension: [Image QR Scanner][ext-webstore]


## Configuration
```toml
# Optional: frontend base URL if app runs on different port, default: `/`
frontendUrl = "http://localhost:5371"

[auth]
jwtSecret = "your-super-secret-change-me" # Required

# Optional: enable M365 login via Entra IP App
[auth.microsoft]
clientId     = "<client ID>"
tenantId     = "<tenant ID>"
clientSecret = "<client secret value>"
redirectUri  = "https://your-domain.de/api/auth/callback/microsoft"
```


## Getting started
```sh
# Run
docker compose up

# Update or initial install
docker compose up --build

# Update via script
bun run infra/updater.ts
```


### Admin activities
```sh
# Manually create user (password prompted interactively)
docker compose exec server ./cli.bin create-user max@muster.de
bun server-cli/src/cli.ts create-user max@muster.de
```


## Development
### Environment Variables
| Var             | Value                                       |
| --------------- | ------------------------------------------- |
| TEAMOTP_DB_PATH | Absolute path, or relative to `server/data` |


### Database migrations
The server uses Drizzle ORM with SQLite migrations stored in `server/drizzle/`.
Pending migrations run automatically on startup.

#### Generate migrations
- Update the schema in `server/src/schema.ts`
- Generate a migration with `bun run db:generate`


<!-- links -->
[ext-webstore]: https://chromewebstore.google.com/detail/image-qr-scanner/moeefnhmhiflglcmjnbnoeijpinjgoop
