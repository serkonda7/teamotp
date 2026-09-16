# Architecture Fixes — Implementation Plan
| # | Phase | Fixes | Effort | Breaking |
| - | ----- | ----- | ------ | -------- |
| 7 | Secret encryption at rest | plaintext vault file | M | needs data migration |
| 8 | Remove module-load side effects | untestable imports, import-order coupling | L | no |
| 9 | Break up `db.ts` god-module | mixed concerns, missing transactions, TOCTOU races | M | no |
| 10 | Session/auth correctness | email-`sub`, triple-query touch, rate-limit reset bug, stale MSAL singleton | S | JWT `sub` change |
| 11 | API and package boundaries | client→server source import, write-only audit, unordered lists, no health probe | M | RPC type import path |

> Status: Phases 1–6 are done and were removed from this plan. Phases 7–8 below
> are unchanged and still pending. Phases 9–11 are new findings from the
> September 2026 review of the current tree — every defect cites a file and line
> that exists today.

---

## Phase 7 — Secret encryption at rest

**Problem.** `// TODO enrypt entire DB` (`db.ts:20`). The `secret` column is
plaintext, so the SQLite file *is* the vault.

**Scope honestly:** this protects stolen database files, volume snapshots and
backups. It does not protect against host compromise, because the server must hold
the key to generate codes. That is still a meaningful improvement — `server/data/`
is bind-mounted in `docker-compose.yml` and ends up in every backup.

Depends on the shipped `auth.appKey` + HKDF derivation (`server/src/keys.ts`).
No new config key is needed here.

### 7.1 Key and cipher

- The encryption key is `getSecretEncryptionKey()` from `keys.ts` —
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
> `jwtKeyVersion` covers the common case — routine signing-key rotation
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

Do this before Phase 9: the test-preload split (`server/bunfig.toml` +
`server/src/tests/setup.ts`) already removed the test-only branches that made
the old implicit initialization load-bearing, which shrinks this refactor
considerably.

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

## Phase 9 — Break up `db.ts` god-module

**Problem.** `server/src/db.ts` (~315 lines) mixes three aggregates in one
module with a shared global handle: OTP entries, tags + memberships, and
users — while `routes/auth.ts:77-79,121-126` reaches past it to touch
`sessions`/`auth_states` tables directly. Every route imports from the same
file, so any change to user queries recompiles entry call sites and every test
imports the whole vault. Two correctness gaps ride along:

- `deleteTag` (`db.ts:232-239`) deletes `entry_tags` rows then the `tags` row
  in two statements with no transaction — a crash between them orphans the tag.
  `normalizeEmails` in `server-cli` uses `sqliteHandle.transaction()` while the
  queries run through drizzle, mixing two transaction APIs on one connection.
- Tag creation is check-then-insert across a layer boundary: `tag_routes.ts:20`
  calls `getTagByName`, then `createTag` inserts. Two concurrent `POST /tags`
  with the same name both pass the check; the loser hits the
  `normalized_name UNIQUE` constraint and falls through `index.ts:33-40`
  `onError` as a 500 instead of the documented 409. Same shape for
  `PUT /otp/:id/tags/:tagId` (`otp_routes.ts:100-111`): existence checks in the
  route, insert in `db.ts:251-253`, FK violation on race → 500.

### 9.1 Steps

1. Split by aggregate, keeping function names stable so routes barely move:
   `db/entries.ts`, `db/tags.ts`, `db/users.ts`. Keep `db.ts` as a thin
   re-export during the move, then delete it. Depends on Phase 8: the split
   files take the `initDb`-provided handle instead of importing a global.
2. Wrap multi-statement writes in `db.transaction()`, not
   `sqliteHandle.transaction()`: `deleteTag`, `normalize-emails`, and the
   Phase 7 `encrypt-secrets` migration. One transaction API, one connection.
3. Push uniqueness to the DB and map it at the boundary: catch the SQLite
   `UNIQUE constraint failed: tags.normalized_name` error in `createTag` (or
   in the route) and return the existing 409 `{ error: 'A tag with this name
   already exists' }`. Keep the pre-check for the fast path — it gives the
   exact message — but the constraint is the source of truth under
   concurrency. Same for `assignTag`: catch FK violations and return 404.
4. Move the `auth_states` insert/select/delete in `routes/auth.ts` behind
   `db/users.ts`-style helpers (`createAuthState`, `consumeAuthState`) so
   routes never touch tables directly. `consumeAuthState` does select +
   delete atomically (delete-where-state-and-not-expired + `returning`), which
   also closes the double-redeem window on the Microsoft callback.

### 9.2 Tests

- Concurrent `createTag` with the same name → exactly one row, loser gets 409
  (assert via direct `createTag` calls racing, plus the 409 body through the route).
- `deleteTag` with an injected mid-transaction failure → tag and assignments
  both still present (no half-delete).
- `consumeAuthState` twice with the same state → first wins, second reports
  expired/missing; no `auth_states` row left behind.

---

## Phase 10 — Session/auth correctness

**Problem.** Four small defects, all in the login/session hot path:

1. **JWT `sub` is the email** (`sessions.ts:89`). Emails are mutable —
   `normalize-emails` rewrites them — so a pre-migration token carries a stale
   `sub` and `audit.ts:70-79` needs its session→`user_id` fallback lookup on
   every request to stay correct. `auth.ts:216-218` (`GET /auth/me`) echoes the
   stale address.
2. **Every authenticated request does 2 selects + 1 write.**
   `middleware/auth.ts:29-32` calls `isValidSession` (select), then
   `touchSession`, which calls `isValidSession` again (second select) before
   the `UPDATE`. `touchSession` also rewrites `last_seen_at` on *every*
   request, turning reads (`GET /otp`, code polling) into SQLite writes.
3. **Rate-limit reset bug** (`middleware/rate_limit.ts:69`): the counter resets
   when `c.res.status < 400`. The Microsoft callback (`routes/auth.ts:104`)
   returns 302 redirects for `invalid_state`/`expired_state` failures
   (`auth.ts:118,124`), so failed callbacks *clear* the attacker's budget
   instead of consuming it.
4. **Stale MSAL singleton** (`routes/auth.ts:22-39`): `_msalClient` caches the
   first `clientId`/`clientSecret`/`tenantId` forever. A config reload (or a
   test swapping `initConfig`) silently keeps talking to the old tenant.
   Login body parsing (`auth.ts:175-180`) is also hand-rolled `req.json()`
   with no schema or size bound, unlike every other write endpoint.

### 10.1 Steps

1. Put the user id in `sub` and move the email to a private claim (e.g.
   `email`). Update `authMiddleware` to load `user_id` from `sub` directly;
   keep `logAccess`'s email snapshot for the audit row but drop the per-request
   `sessions`+`users` fallback selects. Migration: old email-`sub` tokens are
   invalidated on deploy — note it in the CHANGELOG as a one-time logout
   (same cost as the `appKey` derivation change, pay it once).
2. Collapse validate+touch into one atomic statement: `UPDATE sessions SET
   last_seen_at = now WHERE id = ? AND expires_at > now AND last_seen_at >
   now - idle_timeout RETURNING user_id`, throttled so the write happens at
   most once per ~60 s per session (skip the update when `last_seen_at` is
   fresh). `authMiddleware` becomes one query on the hot path, zero on a
   throttled hit.
3. Reset the rate-limit bucket only on 2xx (`c.res.status >= 200 &&
   c.res.status < 300`), never on 3xx/4xx/5xx. Add a regression test through
   `GET /auth/callback/microsoft?code=x&state=y` asserting the counter
   survives a redirect failure.
4. Replace `_msalClient` with a factory keyed by the current Microsoft config
   (rebuild when `clientId`/`tenantId`/`clientSecret`/`redirectUri` differ, or
   just construct per request — MSAL construction is cheap next to the token
   exchange). Validate `POST /auth/login` with a valibot schema
   (`email: pipe(string, trim, maxLength(254))`, `password: pipe(string,
   minLength(1), maxLength(512))`) via the shared `onValidationError` hook so
   oversized bodies fail 400 before `Bun.password.verify` burns CPU.

### 10.2 Tests

- Login, run `normalize-emails`, reuse the old cookie → identity follows the
  user id; `GET /auth/me` returns the *current* email.
- Authenticated `GET /otp` twice within the throttle window → one `UPDATE`
  at most (spy on `db.update` or assert `last_seen_at` unchanged on the second hit).
- N failed Microsoft callbacks from one IP → 429 with `Retry-After`; a
  successful `POST /auth/login` (2xx) still resets the bucket.
- Swapping `initConfig` Microsoft credentials between calls → token exchange
  uses the new tenant (mock `acquireTokenByCode`, assert authority).

---

## Phase 11 — API and package boundaries

**Problem.** Structural issues that slow down every future feature:

1. **Client imports server source.** `client/src/api.ts:4-5` imports
   `AppType` from `server/src/index` and `UpdateOtpEntry` from
   `server/src/types`. The web build typechecks server code; any server-only
   import added transitively (e.g. `bun:sqlite` via `db.ts`) breaks the
   client. `UpdateOtpEntry` already lives in `shared/src/schemas.ts` — the
   client just imports it from the wrong package.
2. **Audit log is write-only.** `audit.ts` inserts on every reveal/create/
   update/archive/tag/login, `pruneExpiredAuditLogs` deletes on a timer, but
   no route or CLI command ever reads `access_log`. Operators cannot answer
   "who revealed this secret?" without opening SQLite by hand.
3. **Lists are unordered and unbounded.** `listEntries` (`db.ts:62-79`) and
   `listTags` (`db.ts:182-194`) have no `ORDER BY` and no `LIMIT`. Row order
   is whatever SQLite feels like after deletes/vacuums, and the full vault
   ships on every poll. `client/src/api.ts:56-59` (`fetch_otps`) already
   re-fetches the whole list per view.
4. **No health probe, ad-hoc logging.** `index.ts` has no `GET /health`
   (liveness without auth, checked by Caddy/compose), and logging is five
   scattered `console.log/error` calls (`db.ts:31`, `auth.ts:137`,
   `index.ts:38,54,73`) with no level, no request id, and secrets-adjacent
   data one `console.error(err)` away from a log file.

### 11.1 Steps

1. Cut the client→server import: derive `AppType` once in `shared` (move the
   Hono route *types* or export an OpenAPI spec from the server and generate
   the client) and change `client/src/api.ts` to `import type { AppType }
   from 'shared/...'` / `import type { UpdateOtpEntry } from
   'shared/src/schemas'`. Enforce with a lint rule or `tsc` project
   reference that forbids `client/**` importing `server/**`. (Do after Phase
   8: `createApp(): Hono` makes the exported type stable.)
2. Add a read path for the audit log: `GET /audit?entryId=&limit=&before=`
   (authenticated, ordered by `created_at DESC`, capped limit, never returns
   secrets/codes — the rows already don't contain them) plus `cli.bin
   query-audit --email --action --since`. Reuse the existing
   `access_log_created_at_idx` index.
3. Order and bound the lists: `ORDER BY label ASC, id ASC` (entries) and
   `ORDER BY name ASC` (tags) behind the current shapes — no client change —
   then add `?limit=`/`?q=` only when a vault measurably needs it. Add the
   missing covering indexes in the same migration: `entries(archived_at)`,
   `entry_tags(entry_id)`, `entry_tags(tag_id)`, `sessions(user_id)`.
4. Add `GET /health` (no auth, returns `{ ok: true }`, exercises no DB or a
   cheap `SELECT 1`) and replace `console.*` with a tiny `log(level, msg,
   fields)` helper defaulting to structured JSON in production and
   human-readable locally. Handle `SIGTERM`/`SIGINT` for graceful drain
   (`server.stop()` + close SQLite) so compose restarts don't cut inflight
   code reveals.

### 11.2 Tests

- `tsc` on the client with `server/` stubbed out (or an import-lint test)
   fails if any `client/**` file imports `server/**`.
- Reveal a code → `GET /audit?entryId=<id>` returns exactly one
   `code.reveal` row with the right `user_email`, ordered newest-first;
   `limit=1` caps the response.
- Seed 3 entries out of order → `GET /otp` always returns label-sorted order;
   `GET /health` returns 200 with no cookie.
- Kill with `SIGTERM` mid-request (smoke test) → inflight request completes,
  process exits 0.
