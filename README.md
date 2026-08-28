# teamotp
## Scanning QR codes
For desktop, we recommend this Chrome extension: [Image QR Scanner][ext-webstore]


## Updating
```sh
bun run infra/updater.ts
```


## Configuration
```toml
# Optional: frontend base URL if app runs on different port, default: `/`
frontendUrl = "http://localhost:5371"

# Optional
host = "0.0.0.0"
port = 3000 # Only for non-docker environments. Overridden by `TEAMOTP_PORT` env var

[auth]
appKey = "your-super-secret-change-me-app-key" # Required, >= 32 characters.
jwtKeyVersion = 1         # Optional: bump to rotate the signing key (logs out all sessions)
secureCookies = false     # Optional for testing. Defaults to `true`
disableLocalLogin = false # Optional

# Optional: fixed-window login rate limit per client IP. Defaults below.
[auth.loginRateLimit]
maxAttempts = 10
windowSeconds = 300

# Optional: enable M365 login via Entra ID App
[auth.microsoft]
clientId     = "<client ID>"
tenantId     = "<tenant ID>"
clientSecret = "<client secret value>"
redirectUri  = "https://your-domain.de/api/auth/callback/microsoft"

# Optional: audit log retention (default 90 days)
[audit]
retentionDays = 90 # Days to keep audit log entries, must be >= 1
```

#### API port in Docker deployments
In Docker (docker-compose) the internal API port is fixed at `3000`: Caddy
proxies to `server:3000`, and the compose file pins `TEAMOTP_PORT` so any
`server.port` from the config file is ignored. Operators only configure the
published host ports (`80`/`443`). The `server.port` config option and the
`TEAMOTP_PORT` variable apply to non-Docker runs only.


### Other admin tasks
```sh
# Create local user (password prompted interactively)
docker compose exec server ./cli.bin create-user max@muster.de
bun server-cli/src/cli.ts create-user max@muster.de

# Normalize emails to lowercase (run once after upgrading to 0.3.0)
docker compose exec server ./cli.bin normalize-emails
bun server-cli/src/cli.ts normalize-emails
```


## Installation
```sh
# Clone main branch
git clone https://github.com/serkonda7/teamotp

# Run updater to get latest stable version
bun run infra/updater.ts
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
