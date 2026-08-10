# Architecture Fixes — Implementation Plan

Derived from the architecture review of v0.2.0. Every defect referenced here was
reproduced against the running app; the probe results are quoted in each phase so
the regression tests can assert the exact opposite.

Phases are ordered by value/risk. Phases 1 and 4 are independent and can be done in
any order. Phase 5 depends on Phase 2; Phase 7 depends on Phase 3 (which introduces
the `appKey` the encryption key is derived from). Phase 8 should come last.

| # | Phase | Fixes | Effort | Breaking |
| - | ----- | ----- | ------ | -------- |
| 2 | Persistent sessions + PKCE state | restart logout, memory leak, broken OAuth on restart | M | logs users out once |
| 3 | Deployment hardening + key/config layout | insecure cookies, exposed port, CORS, no rate limit, hardcoded port, test-config leak | M | config key rename |
| 4 | Email normalization | login lockout, duplicate MS accounts | S | needs data migration |
| 5 | Audit log + user approval | no accountability, JIT provisioning | M | new users need approval |
| 6 | Archive + tag semantics | archived entries serve codes, tag case collisions | S | no |
| 7 | Secret encryption at rest | plaintext vault file | M | needs data migration |
| 8 | Remove module-load side effects | untestable imports, import-order coupling | L | no |

---

## Phase 2 — Persistent sessions and PKCE state

**Problem.** `sessions.ts:15` keeps valid session IDs in a module-level `Set`.
Probes confirmed a valid cookie returns **401** the moment that set loses the entry
(i.e. on every restart, and `docker-compose.yml` sets `restart: unless-stopped`),
and that 1000 created sessions are all still retained with no expiry sweep.

**The same flaw exists a second time.** `auth.ts:35` holds the MSAL PKCE verifiers in
a module-level `Map`, read back in the callback at `auth.ts:114`. A restart between
the redirect to Microsoft and the user's return loses the verifier, so the callback
fails with *"Auth state expired"* and the login has to be retried. It is also the
reason `cleanExpiredStates()` exists (`auth.ts:37`) — a hand-rolled sweep that only
runs when someone happens to start a new login. Both stores move to the database in
this phase; fixing one and not the other leaves the restart problem half-solved.

### 2.1 Schema

Add to `server/src/schema.ts`, then run `bun run db:generate` (produces `0006_*.sql`):

```ts
export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(), // equals the JWT `jti`
	user_id: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	created_at: integer('created_at').notNull(), // unix seconds
	expires_at: integer('expires_at').notNull(),
})

// MSAL PKCE handshake state, replacing the in-memory `pendingStates` Map.
// No user_id: this row exists before anyone is authenticated.
export const auth_states = sqliteTable('auth_states', {
	state: text('state').primaryKey(),
	verifier: text('verifier').notNull(),
	expires_at: integer('expires_at').notNull(),
})
```

Add an index on `expires_at` for both tables, for the sweep.

> The `verifier` is a short-lived PKCE secret with a 10-minute TTL, so it does not
> need the Phase 7 encryption treatment. It does mean an operator with DB read access
> could complete an in-flight OAuth handshake — worth an explicit `DELETE` the moment
> it is consumed, which 2.2 does.

### 2.2 Rewrite `sessions.ts`

Replace the `Set` with DB access, keeping the existing function names so callers
change as little as possible:

- `createSession(userId: string): string` — insert row, return id.
- `isValidSession(sid: string): boolean` — select and check `expires_at > now`.
  An expired row must fail even before the sweep removes it.
- `invalidateSession(sid: string): void` — delete row.
- `sweepExpired(): number` — delete rows where `expires_at <= now` from both
  `sessions` and `auth_states`, returning the total. See 2.4.

`get_signed_jwt(email)` must become `get_signed_jwt(user: User)` because the session
row needs `user_id`. Both call sites (`auth.ts:151` and `auth.ts:179`) already hold
the full `user` object, so this is a two-line change. Keep `sub` as the email in the
JWT payload so `GET /auth/me` is unaffected.

**Introduce a signing-key indirection now.** `sessions.ts:49` and
`middleware/auth.ts:24` both reach for `getConfig().auth.jwtSecret` directly. Phase 3
renames that config key, so add `server/src/keys.ts` with a single
`getSigningKey(): string` and have both call it. Phase 3 then changes one function
body instead of hunting call sites, and Phase 7 adds its encryption-key getter
alongside it.

### 2.3 Move PKCE state into `auth_states`

In `auth.ts`, replace the `pendingStates` Map:

- `/login/microsoft`: `db.insert(auth_states).values({ state, verifier, expires_at })`
  instead of `pendingStates.set(...)`. Drop the `cleanExpiredStates()` call — the
  Phase 2.4 sweep covers it.
- `/callback/microsoft`: select the row, reject if missing or `expires_at <= now`
  (same 400 responses as today), then **delete it immediately** so a state can only
  be redeemed once. The current code already does this with `pendingStates.delete`;
  keep that single-use property, it is what stops replay of a captured `state`.
- Delete `cleanExpiredStates` entirely.

The existing state/cookie cross-check at `auth.ts:110` is unaffected and should stay.

### 2.4 Sweep scheduling

Call a single `sweepExpired()` in `index.ts` inside the `import.meta.main` block —
once at startup, then hourly via `setInterval(...).unref()`. It deletes expired rows
from **both** `sessions` and `auth_states`. Do **not** schedule it at module scope in
`db.ts` or `sessions.ts`, or it will fire during tests and keep the test process
alive.

### 2.5 Test helper impact

`server/src/tests/helpers.ts` calls `createSessionId()`, which now needs a real user
row for the foreign key. Update `createAuthCookie` to upsert a fixed test user
first:

```ts
const TEST_USER_ID = '00000000-0000-7000-8000-000000000001'

function ensureTestUser(): void {
	db.insert(users)
		.values({ id: TEST_USER_ID, email: 'test@example.com', password_hash: null })
		.onConflictDoNothing()
		.run()
}
```

The `onDelete: 'cascade'` on `user_id` means tests that clear the `users` table
clean up their sessions automatically.

### 2.6 Rollout note

Deploying this logs every user out once. That is not a regression — the old
in-memory set was already discarded on the deploy restart. Worth a CHANGELOG line.

### 2.7 Tests

New `server/src/sessions.test.ts`:

- Session created → valid; after `invalidateSession` → invalid.
- Session with `expires_at` in the past → `isValidSession` is false *before* any
  sweep runs.
- `sweepExpired` removes only expired rows and returns the count.
- End-to-end: build a cookie, hit `/otp` (200), delete the session row directly,
  hit `/otp` again (401) — the durable equivalent of the restart probe.

For `auth_states`, in `server/src/routes/auth.test.ts`:

- A state row survives being written and read back across two separate `app.request`
  calls — the durable equivalent of the restart the Map cannot survive.
- Replaying a `state` that was already redeemed → **400** (the row is gone).
- An `auth_states` row past `expires_at` → **400** *"Auth state expired"* before the
  sweep has run.

---

## Phase 3 — Deployment hardening and key/config layout

**Problem.** Both cookies use `secure: process.env.NODE_ENV === 'production'`
(`sessions.ts:8`, `auth.ts:85`), but `NODE_ENV` is never set to `production` in any
Dockerfile, compose file or script — so the real HTTPS deployment ships session
cookies **without the `Secure` flag**. The inverse is worse: `config.ts:70` and
`db.ts:22` are compiled into the production binary, so booting it with
`NODE_ENV=test` silently swaps in the hardcoded public secret `'test_secret'`.
Alongside these, the config schema is missing three things the code wants: a
listening port (`// TODO read port from config` at `index.ts:29`), a key layout that
Phase 7 can extend, and any rate limit on the login endpoints.

### 3.1 Config schema: one app key, explicit cookies, configurable listener

Rework `configSchema` in `server/src/config.ts`:

```ts
const configSchema = v.object({
	auth: v.object({
		// Renamed from `jwtSecret`: this key now backs JWT signing AND (Phase 7)
		// secret encryption, via separate HKDF-derived subkeys.
		appKey: v.pipe(v.string(), v.minLength(32)),
		jwtSecret: v.optional(v.string()), // deprecated alias, see 3.2
		jwtKeyVersion: v.optional(v.number(), 1),
		secureCookies: v.optional(v.boolean(), true),
		loginRateLimit: v.optional(
			v.object({
				maxAttempts: v.optional(v.number(), 10),
				windowSeconds: v.optional(v.number(), 300),
			}),
			{},
		),
		microsoft: /* unchanged */,
	}),
	server: v.optional(
		v.object({
			host: v.optional(v.string(), '0.0.0.0'),
			port: v.optional(v.number(), 3000),
		}),
		{},
	),
	frontendUrl: v.optional(v.string()),
})
```

Then replace both `process.env.NODE_ENV === 'production'` checks with
`getConfig().auth.secureCookies`. Local HTTP development sets
`secureCookies = false` in `server/data/config.toml`. Explicit configuration beats an
ambient env var that nobody sets.

Read `server.host` / `server.port` in `index.ts:30-34` and delete the TODO.

### 3.2 Derive subkeys from `appKey` instead of reusing one secret

Fill in the `keys.ts` stub from Phase 2.2 with HKDF-SHA256 derivation, so JWT signing
and (in Phase 7) secret encryption never share raw key material while the operator
still manages exactly one secret:

```ts
import { hkdfSync } from 'node:crypto'

function derive(info: string, bytes: number): Buffer {
	const appKey = getConfig().auth.appKey
	return Buffer.from(hkdfSync('sha256', appKey, '', info, bytes))
}

// Bumping auth.jwtKeyVersion rotates the signing key alone — every session is
// invalidated, but stored secrets are untouched and need no re-encryption.
export function getSigningKey(): string {
	const version = getConfig().auth.jwtKeyVersion
	return derive(`teamotp:jwt:v${version}`, 32).toString('base64')
}

// Consumed by Phase 7.
export function getSecretEncryptionKey(): Buffer {
	return derive('teamotp:db-secret-enc', 32)
}
```

The `jwtKeyVersion` counter is what keeps the two rotation cadences independent.
Without it, a single `appKey` means you can never rotate the cheap, routine signing
key without also re-encrypting the entire vault — the one real drawback of the
single-key design, and it costs one config field to avoid.

**Migration for the rename.** Accept `jwtSecret` as a deprecated alias for one
release: if `appKey` is absent and `jwtSecret` is present, use it and log a warning
naming the file and the new key. Add a valibot check that at least one is set, with a
message that names both. Update the README config block, `ci/config.smoke.toml`, and
the test config. Removing the alias is a `0.4.0` item.

> Existing deployments keep working on the alias, but note in the CHANGELOG that the
> derivation changes the effective signing key even when the same string is reused —
> so this deploy logs everyone out, exactly like Phase 2. Landing 2 and 3 in the same
> release means users pay that cost once.

### 3.3 Rate-limit the login endpoints

There is no rate limiting anywhere in `server/src`, so `POST /auth/login` accepts
unlimited password guesses. `Bun.password.verify` is deliberately slow, which bounds
throughput but is also a cheap DoS vector — each attempt costs real CPU.

Add `server/src/middleware/rate_limit.ts`: a fixed-window counter keyed by client IP,
holding `{ count, resetAt }` in a `Map`, evicting on read. Apply to `POST /auth/login`
and `GET /auth/callback/microsoft`. On exceed, return **429** with a `Retry-After`
header and no detail about whether the account exists.

Two things to get right:

- **Trust the right IP.** Behind Caddy, `c.req.header('x-forwarded-for')` is the
  client and the socket address is the proxy. Take the *first* entry of the header
  and fall back to the socket address. Do not trust the header when it can be set by
  an untrusted party — with the Phase 3.4 port change, Caddy is the only ingress, so
  this is safe here.
- **Reset the counter on success**, so one user's typo streak cannot lock out a
  shared office NAT for the full window.

> In-memory is a deliberate scope call: unlike sessions, a rate-limit counter losing
> state on restart is a minor availability-favouring failure, not a correctness bug.
> If Phase 2's multi-instance capability is ever actually used, this becomes per
> instance — note it in the module docstring rather than reaching for a DB table now.

### 3.4 Remove the test branches from the production binary

Create `server/bunfig.toml`:

```toml
[test]
preload = ["./src/tests/setup.ts"]
```

Move the `NODE_ENV === 'test'` block out of `config.ts:69-79` into that new
`setup.ts`, which calls `initConfig(...)` with the test config and sets
`Bun.env.TEAMOTP_DB_PATH = ':memory:'`. Because preload runs before test files
import anything, `db.ts` still sees the in-memory path at import time, so
`is_test_run` (`db.ts:22`) can be deleted too. After this, neither the hardcoded
secret nor the test DB branch exists in the shipped binary.

The test config uses `appKey` (not the deprecated alias), and `TEST_SECRET` in
`server/src/tests/helpers.ts:5` must become a call to `getSigningKey()` — otherwise
every test cookie is signed with a key the middleware no longer derives.

### 3.5 Close the network exposure

- `infra/server.Dockerfile`: add `ENV NODE_ENV=production` to the runtime stage
  (defence in depth — nothing depends on it after 3.1, but it stops anything
  downstream from mistaking the container for a dev environment).
- `docker-compose.yml`: delete the `ports: ["3000:3000"]` mapping from the `server`
  service. Caddy reaches it over the compose network; publishing it exposes the API
  over plain HTTP and bypasses TLS entirely. Use `127.0.0.1:3000:3000` if local
  debugging access is wanted.
- `server/src/index.ts:13`: remove `.use('/*', cors())`. Both dev (Vite proxies
  `/api` → `:3000`) and prod (Caddy `handle_path /api*`) are same-origin, so CORS is
  not needed. If it must stay, restrict it to `getConfig().frontendUrl` with
  `credentials: true` — the current wildcard leaves `SameSite: Strict` as the only
  CSRF defence.

### 3.6 Tests

- Config: `secureCookies` defaults to `true` and `server.port` to `3000` when absent.
- Config: `jwtSecret` alone still loads (with a warning); neither key set → a load
  error naming both.
- Login route: response `Set-Cookie` contains `Secure` when configured true, omits
  it when false.
- Keys: `getSigningKey()` is stable across calls, differs from
  `getSecretEncryptionKey()`, and changes when `jwtKeyVersion` is bumped.
- Rate limit: the (n+1)th login attempt in a window → **429** with `Retry-After`;
  a successful login resets the counter; two different IPs get independent budgets.
- Run `bun test` and `bun run test:e2e` after removing CORS to confirm neither the
  Vite proxy nor the Caddy route regressed.

---

## Phase 4 — Email normalization

**Problem.** `server-cli/src/cli.ts:22` lowercases on create; nothing else does, and
SQLite text comparison is case-sensitive. Probes confirmed a user created as
`Max@Muster.de` gets **401** when typing their email with capitals, and that a
Microsoft login returning `Max@Muster.de` **creates a second user row** instead of
taking the account-linking branch at `db.ts:221`.

### 4.1 Normalize in the data layer

Add `server/src/util/email.ts`:

```ts
export function normalize_email(email: string): string {
	return email.trim().toLowerCase()
}
```

Apply it inside the DB functions, not at call sites — that is what allowed the drift:

- `getUserByEmail`: normalize the argument before the `eq` comparison.
- `upsertMicrosoftUser`: normalize `params.email` for both the lookup **and** the
  stored value on insert.
- `server-cli`: replace the inline `.toLowerCase()` with the helper.

### 4.2 Migrate existing rows — carefully

A blind `UPDATE users SET email = lower(email)` can violate the `UNIQUE` constraint
whenever two rows differ only by case, which is exactly the state Probe H produces.
Do **not** put this in the automatic startup migration; a failure there blocks boot.

Instead add a CLI command `cli.bin normalize-emails` that:

1. Selects all users, groups by `lower(email)`.
2. Reports any group with more than one row and **exits non-zero without writing** —
   these are genuine duplicate identities that need a human decision about which row
   (and which `provider_id`) survives.
3. If no collisions, updates each row to its lowercased form inside a transaction.

Document it in the README under "Other admin tasks", and note in the CHANGELOG that
operators should run it once when upgrading.

> Optional follow-up: rebuild the `users` table with
> `email TEXT NOT NULL UNIQUE COLLATE NOCASE` so the database enforces this
> structurally. SQLite requires a table rebuild for the collation change, so it is
> only worth doing alongside another schema migration.

### 4.3 Tests

New `server/src/routes/auth.test.ts` cases:

- User stored lowercase → login succeeds with `Max@Muster.de`, `MAX@MUSTER.DE`, and
  ` max@muster.de ` (leading/trailing whitespace).
- `upsertMicrosoftUser({ email: 'Max@Muster.de' })` against an existing
  `max@muster.de` row → **one** user row, `provider` becomes `microsoft`.

---

## Phase 5 — Audit log and user approval

**Problem.** Every authenticated user is a full admin — the `Role` enum in
`auth-matrix.test.ts:33` has exactly `unauthenticated` and `authenticated`. There is
no record of who revealed which secret, and `db.ts:240` auto-provisions any tenant
user who reaches the Microsoft login URL, granting immediate full vault access.

Depends on Phase 2, which introduces the session → `user_id` link needed to attribute
actions. Today the JWT carries only an email in `sub`.

### 5.1 Access log

```ts
export const access_log = sqliteTable('access_log', {
	id: text('id').primaryKey(),
	user_id: text('user_id').notNull(),   // no FK: the log outlives deleted users
	user_email: text('user_email').notNull(), // denormalized snapshot
	action: text('action').notNull(),
	entry_id: text('entry_id'),
	created_at: integer('created_at').notNull(),
})
```

Deliberately no foreign key and a denormalized email — an audit record must survive
the deletion of the user it describes.

Add `logAccess(c, action, entryId?)` in `server/src/audit.ts`, called explicitly from
the routes rather than via blanket middleware, so it is obvious at each call site
what is recorded. Minimum set:

| Action | Where |
| ------ | ----- |
| `code.reveal` | `GET /otp/:id` — **the** one that matters |
| `entry.create` / `entry.update` / `entry.archive` | `otp_routes.ts` |
| `tag.delete` | `tag_routes.ts` |
| `login.success` / `login.failure` | `auth.ts` (both providers) |

Log the reveal *after* successful generation, and never log the secret or the code.

Retention is unbounded for now; add a `cli.bin prune-audit --older-than 365d` command
if the table becomes a problem.

### 5.2 Gate JIT provisioning

Add to `users`:

```ts
status: text('status').notNull().default('active'),
```

The `'active'` default means the migration leaves every existing user working. Then
change `upsertMicrosoftUser` to insert **new** users with `status: 'pending'`
explicitly. Existing users found by `provider_id` or email keep their status.

Extend `authMiddleware` to load the user and reject non-`active` with **403** and a
distinguishable message (`'Account pending approval'`) so `LoginPage` can render
something useful rather than a generic failure.

Admin operations stay in the CLI — no admin UI needed for this phase:

- `cli.bin list-users` — email, provider, status.
- `cli.bin approve-user <email>` — sets status to `active`.
- `cli.bin disable-user <email>` — sets status to `disabled` and deletes that user's
  sessions (Phase 2 makes this actually possible).

### 5.3 Tests

- Reveal a code → exactly one `code.reveal` row with the right `user_email` and
  `entry_id`; the row contains neither the secret nor the code.
- A `pending` user's valid JWT → **403** on `/otp`; after approval → **200**.
- New Microsoft user → `status = 'pending'`; existing linked user keeps `active`.
- `disable-user` invalidates live sessions immediately.
- Update `auth-matrix.test.ts` with a third role (`pending`) so the matrix keeps
  documenting the real access model.

---

## Phase 6 — Archive and tag semantics

Two confirmed behaviours that are small but user-visible.

### 6.1 Archived entries must stop serving codes

Probe: after `POST /otp/:id/archive`, `GET /otp/:id` still returned
`{"code":"732532"}` while the entry no longer appeared in the default list — a
retired credential that stays fully usable but invisible.

In `GET /otp/:id`, return **410 Gone** with
`{ error: 'OTP entry is archived' }` when `entry.archived_at` is set.

The client never passes `includeArchived` (`client/src/api.ts` / `App.tsx` call
`client.otp.$get()` with no query), so no UI change is required. If an archive view
is added later it should show entries without offering reveal.

### 6.2 Tag names must collide case-insensitively

Probe: creating `Prod` then `prod` both returned **201**. `getTagByName`
(`db.ts:169`) is an exact match and the `UNIQUE` constraint is case-sensitive.

- Change `getTagByName` to compare case-insensitively:

  ```ts
  .where(sql`lower(${tags.name}) = ${name.toLowerCase()}`)
  ```

- Add a migration creating a unique expression index so the DB enforces it:
  `CREATE UNIQUE INDEX tags_name_lower_idx ON tags (lower(name));`
- The index creation fails if duplicates already exist. Have the migration preceded
  by a `cli.bin list-duplicate-tags` check, documented in the CHANGELOG, or make the
  index creation tolerant and resolve duplicates manually first.

### 6.3 Tests

- Archived entry → `GET /otp/:id` returns 410; unarchived entry still returns a code.
- `POST /tags` with `Prod` then `prod` → second returns **409**.
- Existing `tag_routes.test.ts` cases still pass.

---

## Phase 7 — Secret encryption at rest

**Problem.** `// TODO enrypt entire DB` (`db.ts:20`). The `secret` column is
plaintext, so the SQLite file *is* the vault.

**Scope honestly:** this protects stolen database files, volume snapshots and
backups. It does not protect against host compromise, because the server must hold
the key to generate codes. That is still a meaningful improvement — `server/data/`
is bind-mounted in `docker-compose.yml` and ends up in every backup.

Depends on Phase 3, which introduces `auth.appKey` and the HKDF derivation. No new
config key is needed here.

### 7.1 Key and cipher

- The encryption key is `getSecretEncryptionKey()` from `keys.ts` (Phase 3.2) —
  HKDF-derived from `appKey` under the `teamotp:db-secret-enc` label, so it is
  cryptographically independent of the JWT signing key despite sharing one operator-
  managed secret.
- New `server/src/crypto.ts` with `encrypt_secret` / `decrypt_secret` using
  AES-256-GCM via WebCrypto. Store as `enc:v1:<base64 iv>:<base64 ciphertext+tag>`.
  Random 12-byte IV per encryption.
- The `enc:v1:` prefix is what makes a gradual rollout possible: `decrypt_secret`
  returns the input unchanged when the prefix is absent, so the app keeps working on
  a partially-migrated database. The version segment leaves room to rotate.

> **The `appKey` rotation trap.** Because the signing and encryption keys share a
> root, rotating `appKey` re-keys the vault *and* invalidates every session at once.
> `jwtKeyVersion` (Phase 3.1) covers the common case — routine signing-key rotation
> without touching stored secrets. A true `appKey` rotation stays a maintenance
> operation: run `encrypt-secrets --rotate` (7.3) with the server stopped, because a
> running server holding the old derived key will fail to decrypt rows the CLI has
> already re-encrypted. State that explicitly in the README.

### 7.2 Integration points

Encryption belongs in the DB layer so no route can forget it:

- `createEntry` encrypts before insert.
- `getEntryById` decrypts after select.
- `listEntries` does not select `secret` at all — leave it alone.

### 7.3 Migration

Not a drizzle migration — drizzle has no access to the config key. Add
`cli.bin encrypt-secrets`, which walks all entries, skips already-prefixed values,
encrypts the rest in a transaction, and reports the count. Because of the prefix
check it is idempotent and safe to re-run.

Add `cli.bin encrypt-secrets --rotate --old-key <appKey>` for rotation: derive the
old encryption subkey from the supplied old `appKey`, decrypt with it, re-encrypt
with the current one, in a single transaction. Document the stop-the-server
requirement from 7.1.

### 7.4 Tests

- Round-trip: encrypt → decrypt returns the original secret.
- A row written by `createEntry` has a `secret` starting with `enc:v1:` and not
  containing the plaintext.
- `decrypt_secret` passes an unprefixed legacy value through unchanged.
- Code generation is identical before and after migrating a row.
- A wrong key produces a clean error, not a crash.
- Bumping `jwtKeyVersion` leaves `getSecretEncryptionKey()` unchanged, so an
  already-encrypted row still decrypts. This is the test that proves the two
  rotation cadences are actually decoupled.

---

## Phase 8 — Remove module-load side effects

**Problem.** Importing `db.ts` opens the database and runs migrations as a side
effect. `SERVER_ROOT` calls `.unwrap()` at module scope (`server_root.ts:38`), so a
missing marker directory throws during import. `server-cli/src/cli.ts:7` works around
all of this with a lazy `await import` — a workaround for a design problem.

Do this last: Phase 3 removes the test-only branches that make the current implicit
initialization load-bearing, which shrinks this refactor considerably.

### 8.1 Steps

1. Export `initDb(options): Database` from `db.ts` and have the query functions take
   the db handle (or read it from a module-level handle that `initDb` sets and that
   throws a clear error if unset — the same shape as `getConfig`, which already works
   well).
2. Change `SERVER_ROOT` from a top-level `.unwrap()` to `get_server_root(): Result<…>`,
   resolved by the caller during startup with a readable error message.
3. Introduce `createApp(): Hono` in `index.ts` instead of the module-scope `app`
   singleton. Keep exporting `AppType` — `client/src/api.ts` depends on it for RPC
   typing, so derive it as `ReturnType<typeof createApp>`.
4. Update tests to call `createApp()` in `beforeEach`, giving each test file a clean
   instance instead of a shared singleton.
5. Simplify `server-cli` to normal top-level imports.

### 8.2 Success criterion

Importing any server module has no observable side effect: no file opened, no
migration run, no config mutated, nothing thrown.

---

## Regression tests mapped to the original probes

Each confirmed defect gets a test asserting the fixed behaviour. Use this as the
completion checklist.

| Probe | Observed on v0.2.0 | Expected after fix | Phase |
| ----- | ------------------ | ------------------ | ----- |
| A | update rewrote `secret`/`digits`/`period`/`archived_at` | 400, row unchanged | 1 |
| B | update rewrote primary key `id` | 400, original id intact | 1 |
| C | valid cookie → 401 after session store lost | survives restart | 2 |
| D | archived entry returned a live code | 410 Gone | 6 |
| E | `Prod` and `prod` both created | second returns 409 | 6 |
| F | invalid secret → 201, then 500 forever | 400 at creation | 1 |
| G | login with `Max@Muster.de` → 401 | 200 | 4 |
| H | Microsoft login created a duplicate user row | one row, linked | 4 |
| I | 1000 sessions retained, never swept | expired rows removed | 2 |

The three merged items below came from code reading rather than probes, so they have
no "observed" row — write their tests from the phase sections instead:
`auth_states` persistence (2.7), login rate limiting (3.6), and key derivation (3.6).

---

## Cross-cutting notes

**CHANGELOG.** Phases 2 (forced logout), 3 (`jwtSecret` → `appKey` rename, second
forced logout), 4 (`normalize-emails` must be run), 5 (new users need approval),
6 (duplicate tags must be resolved) and 7 (`encrypt-secrets` must be run) all need
operator-facing entries. Phases 3, 4, 6 and 7 have migration steps that can fail on
real data — those belong in an "Upgrade notes" section, not a one-line bullet.

**README.** Update the config block for `appKey`, `jwtKeyVersion`, `secureCookies`,
`loginRateLimit` and `server.port`, and the "Other admin tasks" section for the new
CLI commands. Call out the `jwtSecret` deprecation with its removal release.

**Config validation.** `load_config_file` currently collapses every valibot issue
into `Invalid configuration at ${path}` (`config.ts:45`). Phase 3 roughly triples the
schema, so include the failing field paths in the message — otherwise a
misconfigured deployment gives an operator nothing to act on. This matters most for
the `appKey`/`jwtSecret` either-or check, where a bare "invalid configuration" on a
key rename is actively misleading.

**Sequencing note.** Phase 3 is the hinge: it renames the config key Phase 2's
`keys.ts` reads and produces the derivation Phase 7 consumes. If phases are split
across releases, keep 2 and 3 in the same one — each forces a logout on its own, and
shipping them together makes users pay that cost once.

**Version.** This is a breaking-ish set of changes to auth and data handling. Ship
phases 1–4 as `0.3.0` and phases 5–7 as `0.4.0` rather than accumulating them into
one release with several manual migration steps. Drop the deprecated `jwtSecret`
alias in `0.4.0`.
