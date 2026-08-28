# Architecture Fixes — Implementation Plan

Derived from the architecture review of v0.2.0. Every defect referenced here was
reproduced against the running app; the probe results are quoted in each phase so
the regression tests can assert the exact opposite.

Phases are ordered by value/risk. Phases 1 and 4 are independent and can be done in
any order. Phase 5 depends on Phase 2; Phase 7 depends on Phase 3 (which introduces
the `appKey` the encryption key is derived from). Phase 8 should come last.

| # | Phase | Fixes | Effort | Breaking |
| - | ----- | ----- | ------ | -------- |
| 5 | Audit log + user approval | no accountability, JIT provisioning | M | new users need approval |
| 6 | Archive + tag semantics | archived entries serve codes, tag case collisions | S | no |
| 7 | Secret encryption at rest | plaintext vault file | M | needs data migration |
| 8 | Remove module-load side effects | untestable imports, import-order coupling | L | no |

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

**README.** Update the config block for `appKey`, `jwtKeyVersion`,
`loginRateLimit` and `server.port` (including the `TEAMOTP_PORT` override
precedence), and the "Other admin tasks" section for the new CLI commands. Call out
the `jwtSecret` deprecation with its removal release.

**Config validation.** Covered as part of Phase 3.1: `load_config_file` collapses
every valibot issue into `Invalid configuration at ${path}` (`config.ts:45`), and the
failing field paths must appear in the message once the schema triples.

**Sequencing note.** Phase 3 is the hinge: it renames the config key Phase 2's
`keys.ts` reads and produces the derivation Phase 7 consumes. If phases are split
across releases, keep 2 and 3 in the same one — each forces a logout on its own, and
shipping them together makes users pay that cost once.

**Version.** This is a breaking-ish set of changes to auth and data handling. Ship
phases 1–4 as `0.3.0` and phases 5–7 as `0.4.0` rather than accumulating them into
one release with several manual migration steps. Drop the deprecated `jwtSecret`
alias in `0.4.0`.
