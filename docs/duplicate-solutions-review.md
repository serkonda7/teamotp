# Duplicate Solutions Review — Same Problem, Multiple Implementations

Date: 2026-09-16
Scope: `server/src`, `server-cli`, `client/src`, `shared/`, `infra/`
Status: resolved on branch `fix/duplicate-solutions` (2026-09-18) — see table below

## Resolution

All findings fixed, one commit each, on `fix/duplicate-solutions`:

| # | Finding | Commit | Resolution |
|---|---|---|---|
| 1 | Session validity queried 2x | `baece88` | `touchSession()` returns `boolean`; middleware calls it once |
| 2 | Normalization triple-layered | `36262d8` | DB trusts schema output; otpauth parser emits lowercase algorithm |
| 3 | Email normalize forked | `b39902c` + merge below | Single `normalize_key()` in `shared/src/normalize.ts`; `toLowerCase` everywhere |
| 4 | 3 clock domains | `1d49986` | Tests use `nowSeconds()`; ISO/ms exceptions documented |
| 5 | Valibot formatter duplicated | `dc23630` | Shared `formatValibotIssues()` |
| 6 | Validation strictness | `b988251` | `strictObject` for all API inputs; `LoginSchema` on `/login` |
| 7 | `{ error }` contract | `9c9e706` | Server `jsonError()`; client reads via exported `to_result()` |
| 8 | Client auth bypasses RPC | `efa5447` | `api_auth.ts` wrapper; single `loadCode()` in `OtpListItem` |
| 9 | Path/env resolution x3 | `ba06d0c` | `getTrimmedEnv()` + `resolveInDataDir()` |
| 10 | UUID v4 vs v7 | `84f903a` | Sessions use `Bun.randomUUIDv7()` |
| 11 | Cookie + prompt forks | `726adbb` | `getStateCookieOpts()`; mirrored delete flags; shared `prompt_line()` |
| 12 | Audit sweep scheduling | `2014e6b` | Shared `start_sweep()` (`logLoginAttempt`/`logAccess` already thin wrappers) |

## 1. Session validity queried 2x per request (high)

- `server/src/middleware/auth.ts:29` calls `isValidSession(payload.jti)`
- `server/src/sessions.ts:55` calls `isValidSession(sid)` again inside `touchSession()`
- `server/src/sessions.ts:54-59` then does `UPDATE last_seen_at`

Fix: make `touchSession()` return `boolean` and call it once from `auth.ts`; remove the first `isValidSession()` check.

## 2. Normalization triple-layered (high)

Same `upper/lower/trim` problem in 3 layers (redundant double-normalization):

- Secret: `shared/src/schemas.ts:19` (`replace(/\s/g,'').toUpperCase()`) + `server/src/db.ts:119` (`secret.toUpperCase()`)
- Algorithm: `shared/src/schemas.ts:34` (`toLowerCase` + picklist) + `server/src/db.ts:112` (`obj.algorithm?.toLowerCase() ?? 'sha1'`) + `client/src/otpauth_parse.ts:40` (`algorithm.toUpperCase()` — opposite case)
- Color: `shared/src/schemas.ts:55-59` (`toLowerCase`) + `server/src/db.ts:201` (`color.toLowerCase()`)
- Tag name: `server/src/db.ts:197,207,227` + SQL `lower(name)` backfill in `server/drizzle/0008_tag_normalized.sql:3` + unique index on `normalized_name` in `server/src/schema.ts:18`

Fix: normalize once at schema boundary (`shared/src/schemas.ts`), remove DB re-lowercasing; keep DB constraint only as safety net.

## 3. Email normalize forked (medium)

- Canonical: `server/src/util/email.ts:1-2` (`trim().toLowerCase()`)
- Reused correctly in `server/src/db.ts:262,273,285` and `server-cli/src/cli.ts:9,11,40,47,68,104,113`
- Re-implemented inline:
  - `server/src/db.ts:227` (`name.trim().toLowerCase()`)
  - `server/src/db.ts:197,207` (split trim + lower)
  - `shared/src/schemas.ts:34,58` (valibot-level duplicate)
  - `client/src/util/otp_search.ts:3-4` (`toLocaleLowerCase` vs `toLowerCase`)
  - `client/src/otpauth_parse.ts:12`, `infra/updater.ts:117-118`

Fix: reuse `normalize_email()` server-side; add shared `normalize_search()` and reuse in client; standardize on `toLowerCase()`.

## 4. Time handling — 3 clock domains (medium)

- Canonical: `server/src/util/time.ts:1-2` (`nowSeconds()`)
- Used in `server/src/sessions.ts:27,46,58,67,86`, `server/src/routes/auth.ts:78,122`, `server/src/audit.ts:36,128`
- Bypassed:
  - `server/src/middleware/rate_limit.ts:42,54,61` (`Date.now()` ms-window)
  - `server/src/tests/helpers.ts:21`, `server/src/routes/auth.test.ts:111,121` (inline `Math.floor(Date.now()/1000)`)
  - `server/src/db.ts:177` (`new Date().toISOString()` string vs integer seconds)
  - `client/src/util/idle_timeout.ts:14,25,41`, `client/src/components/OtpListItem.tsx:91,131`

Fix: use `nowSeconds()` everywhere server-side including tests; document `archived_at` ISO exception or convert to seconds.

## 5. Valibot issue formatter duplicated (medium)

- `server/src/middleware/validation.ts:11-30` uses `v.getDotPath(issue)`, special-cases `required` / `strict_object`
- `server/src/config.ts:52-59` uses `issue.path?.map(i=>String(i.key)).join('.')`, same `join('; ')`, divergent path logic

Fix: extract shared `formatValibotIssues()` in `shared/` or `server/src/util/`.

## 6. Validation strictness inconsistent (medium)

- `server/src/config.ts:8,9,14,23,32,40` all `v.strictObject`
- `shared/src/schemas.ts:27` (`NewOtpEntrySchema: v.object`), `:53` (`NewTagSchema: v.object`) strip unknown keys, vs `:45` (`UpdateOtpEntrySchema: v.strictObject`) rejects them
- Manual vs schema: `server/src/routes/auth.ts:175-180` hand-rolls `if(!body?.email)` while `server/src/routes/otp_routes.ts:31,64` and `server/src/routes/tag_routes.ts:18` use `vValidator(..., onValidationError)`
- Client pre-validation duplicates server `minLength(1)`: `client/src/components/EditDialog.tsx:143-147`, `client/src/components/TagsPage.tsx:43-47`, `client/src/components/AddFromOtpauthForm.tsx:23-27`

Fix: standardize on `strictObject` for API inputs; add valibot validator to login route; keep client checks as UX-only.

## 7. `{ error }` contract built ~20x, read 2 ways (medium)

Producers (all `c.json({ error }, status)`):
- `server/src/middleware/auth.ts:21,30,37`
- `server/src/middleware/rate_limit.ts:60`
- `server/src/middleware/validation.ts:45`
- `server/src/routes/auth.ts:71,109,139,144,157,173,179,185,190,196`
- `server/src/routes/otp_routes.ts:34,48,51,56,69,82,93,105,108,121,124`
- `server/src/routes/tag_routes.ts:21,33`
- `server/src/index.ts:35,39`

Consumers:
- `client/src/util/api_error.ts:3-10` (`read_api_error`)
- `client/src/api.ts:37-52` (`to_result`)
- Bypasses duplicating logic: `client/src/components/AddFromOtpauthForm.tsx:37-44`, `client/src/components/login/LoginPage.tsx:75-76`

Fix: add server `jsonError(c, msg, status)` helper; route all client reads through `to_result()`.

## 8. Client auth bypasses RPC (medium)

- Typed RPC (`hono/client`): `client/src/api.ts:11,57-118`
- Raw fetches for auth: `client/src/App.tsx:126` (`/api/auth/me`), `:148,260` (`/api/auth/logout`), `client/src/components/login/LoginPage.tsx:18,69-73`
- `client/src/components/OtpListItem.tsx:82,101,168` repeats `fetch_otp_code` + `Result.isError` handling 3x

Fix: extend RPC client to auth endpoints or add `api_auth.ts` wrapper; unify `OtpListItem` fetch blocks.

## 9. Path / env resolution x3 (low)

- `server/src/util/server_root.ts:22-36` (`find_server_root`)
- `server/src/db.ts:45-60` (`TEAMOTP_DB_PATH?.trim()`)
- `server/src/index.ts:15-27` (`TEAMOTP_CONFIG_PATH?.trim()`)
- `server/src/config.ts:104-113` (`TEAMOTP_PORT?.trim()` + range check)

Fix: shared `getTrimmedEnv(name)` + `resolveInDataDir()` helper.

## 10. UUID v4 vs v7 (low)

- `server/src/sessions.ts:26` (`crypto.randomUUID()` v4)
- `server/src/db.ts:111,199,305`, `server/src/audit.ts:31`, `server-cli/src/cli.ts:19` (`Bun.randomUUIDv7()` v7)
- `server/src/tests/helpers.ts:8` hardcoded UUID

Fix: standardize on `Bun.randomUUIDv7()`.

## 11. Cookie + prompt forks (low)

- `server/src/sessions.ts:13-21` (`getSessionCookieOpts`, `SameSite=Strict`) vs inline `ms_auth_state` in `server/src/routes/auth.ts:89-95` (`SameSite=Lax`)
- Deletions inconsistent: `:166` vs `:210` (missing `secure`/`sameSite` mirror)
- Prompts: `server-cli/src/cli.ts:128-142` (`askPassword`) vs `infra/updater.ts:107-126` (`ask_confirm`) — both `readline`

Fix: `getStateCookieOpts()` helper reusing secure flag; shared `prompt()` utility.

## 12. Audit logging wrappers (low)

- `server/src/audit.ts:21-42` (`createAuditLog`), `:51-89` (`logAccess`), `:96-104` (`logLoginAttempt`)
- 11x `logLoginAttempt` in `routes/auth.ts:117,123,138,143,156,178,184,189,195` + 6x `logAccess` in otp/tag routes
- Sweeps duplicated: `SESSION_SWEEP_INTERVAL_MS` (`sessions.ts:23`) vs `AUDIT_SWEEP_INTERVAL_MS` (`audit.ts:142`), both `setInterval(...).unref()` in `index.ts:61,65`

## Priority

Highest ROI: 1, 2, 5, 7.
