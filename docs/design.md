# TeamOTP — Web-Based TOTP Manager for MSP Teams

A lightweight, self-hosted TOTP vault for small MSP teams. Authenticated via LDAP, with RBAC, encrypted secrets at rest, and a soft-delete trash system.

---

## Core Goals

- Shared TOTP vault, browser-accessible; entries are a flat list (no client grouping for now)
- LDAP-backed authentication (no local user database)
- Three roles with distinct permissions: **admin**, **editor**, **viewer**
- All TOTP secrets encrypted at rest; raw secrets never sent to the browser
- Self-hostable on-prem with Docker as the primary distribution artifact

---

## Architecture

```
teamotp/
├── src/
│   ├── server/
│   │   ├── index.ts            # Entry point, Bun.serve bootstrap + route table
│   │   ├── db.ts               # bun:sqlite access layer + migrations
│   │   ├── totp.ts             # otplib wrapper: generate code + remaining TTL
│   │   ├── session.ts          # In-memory session store (Map + TTL)
│   │   ├── ldap.ts             # LDAP bind + group-to-role mapping
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Session validation, attaches user+role to request
│   │   │   ├── rbac.ts         # Role guard factory (requireRole(...))
│   │   │   └── headers.ts      # Security headers (CSP, HSTS, etc.)
│   │   │
│   │   └── routes/
│   │       ├── auth.ts         # POST /api/auth/login, /logout, GET /api/auth/me
│   │       ├── otp.ts          # GET /api/otp, POST /api/otp
│   │       ├── trash.ts        # GET/DELETE /api/trash, POST /api/trash/:id/restore
│   │       └── codes.ts        # GET /api/otp/:id/code
│   │
│   ├── shared/
│   │   └── models/
│   │       ├── otp.ts          # OtpEntry, NewOtpEntry, OtpAlgorithm, OtpDigits, OtpPeriod
│   │       └── session.ts      # Session type (userId, role, expiresAt)
│   │
│   └── frontend/               # Vanilla TS SPA, bundled by Bun
│       ├── index.html
│       ├── main.ts             # Bootstrap + hash router
│       ├── api.ts              # Typed fetch wrapper
│       ├── auth.ts             # Role-aware UI guards
│       ├── styles/
│       │   └── main.css
│       └── views/
│           ├── login.ts        # LDAP credential form
│           ├── vault.ts        # Live TOTP codes + countdown rings
│           ├── manage.ts       # Add/edit clients and entries (editor+)
│           ├── trash.ts        # Trash view: restore (editor+) / purge (admin)
│           └── settings.ts     # Admin: LDAP group mapping config
│
├── data/                       # Gitignored volume mount
│   └── teamotp.db
│
└── ... # config files
```

---

## Tech Stack

| Concern | Choice | Rationale | Status |
|---|---|---|---|
| Runtime & bundler | **Bun** | Server, bundler, test runner in one | ✓ |
| Language | **TypeScript** | Type safety across API contracts and crypto code | ✓ |
| Linting / formatting | **Biome** | Replaces ESLint + Prettier | ✓ |
| Database | **SQLite** (`bun:sqlite`) | Self-contained, zero infra, built into Bun | ✓ |
| TOTP | **`otplib`** | RFC 6238, well-tested, actively maintained | (Planned) |
| Authentication | **LDAP** (`ldapts`) | Delegates auth entirely to directory service | (Planned) |
| Sessions | In-memory `Map` with expiry | Sufficient for small teams | (Planned) |
| Frontend routing | Hash-based (`#/vault`) | No server-side routing config needed | (Planned) |
| Styling | Vanilla CSS | Full control, matches stack constraints | (Planned) |
| Deployment | **Docker** + `docker-compose` | On-prem install, reproducible environment | (Planned) |

> `ldapts` is the recommended LDAP client for Node-compatible runtimes. It uses pure TS, supports TLS, and has no native bindings — making it Bun-compatible and Docker-friendly.

---

## Roles & Permissions

| Action | viewer | editor | admin |
|---|:---:|:---:|:---:|
| View TOTP codes | ✓ | ✓ | ✓ |
| Add new TOTP entry | ✓ | ✓ | ✓ |
| Edit client / entry metadata | — | ✓ | ✓ |
| Soft-delete (send to trash) | — | ✓ | ✓ |
| Restore from trash | — | ✓ | ✓ |
| Permanently delete from trash | — | — | ✓ |
| Manage clients (create/edit) | — | ✓ | ✓ |
| Configure LDAP group mapping | — | — | ✓ |

> **Editing is role-based, not ownership-based.** A viewer who created an entry cannot edit it; editor role is always required regardless of who created the record.

Roles are resolved from LDAP group membership at login time and stored in the session. No role data is persisted in SQLite.

---

## LDAP Integration

LDAP groups are mapped to app roles via environment variables (or an admin UI in phase 2):

```env
LDAP_URL=ldaps://ldap.example.com:636
LDAP_BIND_DN=cn=teamotp,ou=service-accounts,dc=example,dc=com
LDAP_BIND_PASSWORD=...
LDAP_BASE_DN=ou=users,dc=example,dc=com
LDAP_GROUP_ADMIN=cn=teamotp-admins,ou=groups,dc=example,dc=com
LDAP_GROUP_EDITOR=cn=teamotp-editors,ou=groups,dc=example,dc=com
LDAP_GROUP_VIEWER=cn=teamotp-viewers,ou=groups,dc=example,dc=com
```

**Login flow:**
1. Client POSTs `{ username, password }` to `/api/auth/login`
2. Server binds to LDAP as the service account, searches for the user DN
3. Attempts a bind with the user's DN + submitted password
4. On success, queries the user's group memberships → resolves role using **highest-wins** precedence: `admin > editor > viewer`
5. Creates a server-side session, sets `HttpOnly` session cookie

---

## Data Model

Roles and users are **not** stored in SQLite — only app data is.

### `entries`
| Column | Type | Notes | Status |
|---|---|---|---|
| `id` | TEXT (UUID) | PK | ✓ |
| `label` | TEXT | e.g. "AWS Root" | ✓ |
| `issuer` | TEXT | Required | ✓ |
| `secret` | TEXT | Plaintext (Temporary for Phase 1) | ✓ |
| `algorithm` | TEXT | SHA1 / SHA256 / SHA512 | ✓ |
| `digits` | INTEGER | 6 or 8 | ✓ |
| `period` | INTEGER | 30 or 60 | ✓ |

> The `OtpEntry` type (used in API responses) exposes `secret` as a plain field — the enc/IV split is a persistence detail hidden inside the server. Raw secrets are **never** sent to the frontend; only computed OTP codes are.

### `audit_log`
| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER | PK, autoincrement |
| `actor` | TEXT | LDAP username of the user who triggered the event |
| `action` | TEXT | Enum: `entry.created`, `entry.updated`, `entry.deleted`, `entry.restored`, `entry.purged`, `client.created`, `client.updated`, `client.deleted`, `client.restored`, `client.purged`, `code.accessed` |
| `target_id` | TEXT | UUID of the affected client or entry |
| `target_label` | TEXT | Snapshot of the label at time of event (stays readable after deletion) |
| `diff` | TEXT | JSON before/after for `*.updated` events; NULL otherwise |
| `ip` | TEXT | Client IP address |
| `created_at` | INTEGER | Unix timestamp |

All write operations and every `/api/entries/:id/code` call write an audit log row. The log is **append-only** — no update or delete routes are exposed for it.

---

## Security

> **TOTP secrets are never returned to the frontend — only the computed OTP code.**

- **Secrets** encrypted with AES-256-GCM; key derived from `SECRET_KEY` env var (never stored)
- **LDAP over TLS** (`ldaps://` or STARTTLS); verify server certificate in production
- **Sessions**: `HttpOnly; Secure; SameSite=Strict` cookie, 8h TTL
- **Rate limiting**: Login route — simple in-memory per-IP counter
- **Security headers**: CSP, X-Frame-Options, X-Content-Type-Options via middleware
- **HTTPS**: Terminated at reverse proxy (nginx/Caddy); documented in Docker Compose example

---

## API Surface

| Method | Path | Min Role | Description | Status |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | — | LDAP auth, set session cookie | (Planned) |
| `POST` | `/api/auth/logout` | viewer | Invalidate session | (Planned) |
| `GET` | `/api/auth/me` | viewer | Current user info + role | (Planned) |
| `GET` | `/api/otp` | viewer | List all active OTP entries | ✓ |
| `POST` | `/api/otp` | viewer | Add a new OTP entry | ✓ |
| `PATCH` | `/api/otp/:id` | editor | Update entry metadata | (Planned) |
| `DELETE` | `/api/otp/:id` | editor | Soft-delete entry | (Planned) |
| `GET` | `/api/otp/:id/code` | viewer | Get current OTP code + `validFor` seconds | (Planned) |
| `GET` | `/api/audit` | admin | Paginated audit log | (Planned) |
| `GET` | `/api/trash` | editor | List trashed entries | (Planned) |
| `POST` | `/api/trash/:id/restore` | editor | Restore entry from trash | (Planned) |
| `DELETE` | `/api/trash/:id` | admin | Permanently delete from trash | (Planned) |

---

## Frontend Views

| View | Route | Min Role | Purpose |
|---|---|---|---|
| **Login** | `#/login` | — | LDAP credential form |
| **Vault** | `#/vault` | viewer | Live TOTP codes, countdown rings, copy |
| **Manage** | `#/manage` | editor | Add / edit / delete OTP entries, QR import |
| **Trash** | `#/trash` | editor | View, restore, or purge soft-deleted entries |
| **Audit Log** | `#/audit` | admin | Filterable, paginated audit log |
| **Settings** | `#/settings` | admin | LDAP group mapping (phase 2) |

### UX Details
- SVG countdown ring per code, ticks every second
- Copy-to-clipboard button per entry
- Clients collapsed/expanded with persistent state
- Global search/filter
- Role-aware UI: restricted actions hidden (not just disabled) for lower roles
- QR code import via `BarcodeDetector` API with manual fallback

---

## Deployment

### Docker
- **Base image**: `oven/bun:1-alpine` — minimal, official Bun image
- **Multi-stage build**: stage 1 bundles the frontend + compiles TS; stage 2 is the lean runtime image
- `data/` mounted as a named volume for the SQLite database
- All config via environment variables (`.env`, documented in `.env.example`)

### `docker-compose.yml` (example)
```yaml
services:
  teamotp:
    image: teamotp:latest
    ports:
      - "3000:3000"
    volumes:
      - teamotp_data:/app/data
    env_file: .env
    restart: unless-stopped

volumes:
  teamotp_data:
```

> HTTPS is expected at the reverse proxy layer. The app itself speaks HTTP internally only.

---

## Phased Delivery

### Phase 1 — MVP
- [x] Project scaffolding (Bun, TS, Biome)
- [ ] Dockerfile
- [x] SQLite initial schema
- [ ] Migration runner
- [ ] LDAP auth service + login/logout routes
- [ ] Session middleware + RBAC middleware
- [ ] Crypto service (AES-256-GCM)
- [ ] TOTP service (`otplib` wrapper)
- [ ] Audit log service (append-only writes on all mutations + code access)
- [/] REST API (Started: `GET /api/otp`, `POST /api/otp`)
- [ ] Frontend: Login + Vault (live codes + countdown)
- [ ] Role-aware UI guards

### Phase 2 — Polish
- [ ] Manage view (add/edit/delete entries, QR import)
- [ ] Trash view (restore / purge)
- [ ] Audit log view (filterable by actor / action / date)
- [ ] Settings view (LDAP group mapping UI)

### Phase 3 — Hardening & Distribution
- [ ] Rate limiting on login route
- [ ] Session timeout UI warning
- [ ] `docker-compose.yml` with reverse proxy example
- [ ] README: self-hosting + LDAP setup guide

---

## Verification Plan

### Automated Tests (`bun test`)
- `services/totp.ts` — RFC 6238 known-vector test cases via `otplib`
- `services/crypto.ts` — Encrypt → decrypt round-trips
- `services/ldap.ts` — Mock LDAP bind, group resolution → role mapping
- `routes/auth.ts` — Login with mocked LDAP: success, bad credentials, no group membership
- `routes/otp.ts` — `POST /api/otp` validation, `GET /api/otp` listing, soft-delete, assert `deleted_at` set correctly
- `middleware/rbac.ts` — All three roles against all permission boundaries
- `services/audit.ts` — Assert rows written on create/update/delete/code-access; assert no delete route exists

### Manual Verification
- Login flow against a real (or test) LDAP server
- Vault view: live codes tick, match a reference app (Aegis/Authy) for the same secret
- Viewer cannot access Manage/Trash routes (UI hidden + API returns 403)
- Editor cannot permanently delete from trash (UI hidden + API returns 403)
- Raw TOTP secret never appears in `GET /api/otp` response or browser network tab; only codes via `/api/otp/:id/code`
- Audit log: code access events appear after generating a code; diff field populated on edits
