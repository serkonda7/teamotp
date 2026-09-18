# Architecture Fixes — Implementation Plan
| # | Phase | Fixes | Effort | Breaking |
| - | ----- | ----- | ------ | -------- |
| 8 | Remove module-load side effects | untestable imports, import-order coupling | L | no |
| 9 | Break up `db.ts` god-module | mixed concerns, missing transactions, TOCTOU races | M | no |
| 10 | Session/auth correctness | email-`sub`, triple-query touch, rate-limit reset bug, stale MSAL singleton | S | JWT `sub` change |
| 11 | API and package boundaries | client→server source import, write-only audit, unordered lists, no health probe | M | RPC type import path |

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
