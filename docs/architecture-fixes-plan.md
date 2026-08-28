# Architecture Fixes — Implementation Plan
| # | Phase | Fixes | Effort | Breaking |
| - | ----- | ----- | ------ | -------- |
| 7 | Secret encryption at rest | plaintext vault file | M | needs data migration |
| 8 | Remove module-load side effects | untestable imports, import-order coupling | L | no |

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
