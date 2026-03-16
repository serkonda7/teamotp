# TeamOTP — Web-Based TOTP Manager for MSP Teams

A lightweight, self-hosted TOTP vault for small MSP teams. Organized by client → service hierarchy, authenticated via LDAP, with RBAC, encrypted secrets at rest, and a soft-delete trash system.

---

## Core Goals

- Shared TOTP vault, browser-accessible, organized as *Client → TOTP entry*
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
│   │   ├── index.ts            # Entry point, Bun HTTP server bootstrap
│   │   ├── router.ts           # Route registration
│   │   ├── middleware/
│   │   │   ├── auth.ts         # Session validation, attaches user+role to request
│   │   │   ├── rbac.ts         # Role guard factory (requireRole(...))
│   │   │   └── headers.ts      # Security headers (CSP, HSTS, etc.)
│   │   └── routes/
│   │       ├── auth.ts         # POST /api/auth/login, /logout, GET /api/auth/me
│   │       ├── clients.ts      # CRUD /api/clients
│   │       ├── entries.ts      # CRUD /api/entries
│   │       ├── trash.ts        # GET/DELETE /api/trash, POST /api/trash/:id/restore
│   │       └── codes.ts        # GET /api/entries/:id/code
│   │
│   ├── services/
│   │   ├── ldap.ts             # LDAP bind + group-to-role mapping
│   │   ├── session.ts          # In-memory session store (Map + TTL)
│   │   ├── totp.ts             # otplib wrapper: generate code + remaining TTL
│   │   ├── crypto.ts           # AES-256-GCM encrypt/decrypt (Web Crypto API)
│   │   └── db.ts               # bun:sqlite access layer + migrations
│   │
│   ├── models/
│   │   ├── session.ts          # Session type (userId, role, expiresAt)
│   │   ├── client.ts           # Client type
│   │   └── entry.ts            # TOTP entry type
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
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── biome.json
├── bunfig.toml
├── tsconfig.json
└── package.json
```

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Runtime & bundler | **Bun** | Server, bundler, test runner in one |
| Language | **TypeScript** | Type safety across API contracts and crypto code |
| Linting / formatting | **Biome** | Replaces ESLint + Prettier |
| Database | **SQLite** (`bun:sqlite`) | Self-contained, zero infra, built into Bun |
| TOTP | **`otplib`** | RFC 6238, well-tested, actively maintained |
| Encryption | **Web Crypto API** (`AES-256-GCM`) | Native to Bun, no extra dependency |
| Authentication | **LDAP** (`ldapts`) | Delegates auth entirely to directory service |
| Sessions | In-memory `Map` with expiry | Sufficient for small teams |
| Frontend routing | Hash-based (`#/vault`) | No server-side routing config needed |
| Styling | Vanilla CSS | Full control, matches stack constraints |
| Deployment | **Docker** + `docker-compose` | On-prem install, reproducible environment |

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

### `clients`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `name` | TEXT | e.g. "Acme Corp" |
| `notes` | TEXT | Optional |
| `deleted_at` | INTEGER | NULL = active; timestamp = in trash |
| `created_at` | INTEGER | |
| `created_by` | TEXT | LDAP username |

### `entries`
| Column | Type | Notes |
|---|---|---|
| `id` | TEXT (UUID) | PK |
| `client_id` | TEXT | FK → clients |
| `label` | TEXT | e.g. "AWS Root" |
| `issuer` | TEXT | Optional |
| `secret_enc` | TEXT | AES-256-GCM ciphertext (base64) |
| `secret_iv` | TEXT | IV for decryption (base64) |
| `algorithm` | TEXT | SHA1 / SHA256 / SHA512 |
| `digits` | INTEGER | 6 or 8 |
| `period` | INTEGER | 30 or 60 |
| `deleted_at` | INTEGER | NULL = active; timestamp = in trash |
| `created_at` | INTEGER | |
| `created_by` | TEXT | LDAP username |

> Soft-delete applies to both clients and entries. Deleting a client cascades soft-delete to all its entries.

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

| Method | Path | Min Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | LDAP auth, set session cookie |
| `POST` | `/api/auth/logout` | viewer | Invalidate session |
| `GET` | `/api/auth/me` | viewer | Current user info + role |
| `GET` | `/api/clients` | viewer | List active clients |
| `POST` | `/api/clients` | editor | Create client |
| `PATCH` | `/api/clients/:id` | editor | Update client |
| `DELETE` | `/api/clients/:id` | editor | Soft-delete client + entries |
| `GET` | `/api/clients/:id/entries` | viewer | List active entries for client |
| `POST` | `/api/entries` | viewer | Add new TOTP entry |
| `PATCH` | `/api/entries/:id` | editor | Update entry metadata |
| `DELETE` | `/api/entries/:id` | editor | Soft-delete entry |
| `GET` | `/api/entries/:id/code` | viewer | Get current OTP code + `validFor` seconds; writes `code.accessed` audit event |
| `GET` | `/api/audit` | admin | Paginated audit log |
| `GET` | `/api/trash` | editor | List trashed clients + entries |
| `POST` | `/api/trash/:id/restore` | editor | Restore item from trash |
| `DELETE` | `/api/trash/:id` | admin | Permanently delete from trash |

---

## Frontend Views

| View | Route | Min Role | Purpose |
|---|---|---|---|
| **Login** | `#/login` | — | LDAP credential form |
| **Vault** | `#/vault` | viewer | Live TOTP codes, countdown rings, copy |
| **Manage** | `#/manage` | editor | CRUD clients + entries, QR import |
| **Trash** | `#/trash` | editor | View, restore, or purge soft-deleted items |
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
- [ ] Project scaffolding (Bun, TS, Biome, Dockerfile)
- [ ] SQLite schema + migration runner
- [ ] LDAP auth service + login/logout routes
- [ ] Session middleware + RBAC middleware
- [ ] Crypto service (AES-256-GCM)
- [ ] TOTP service (`otplib` wrapper)
- [ ] Audit log service (append-only writes on all mutations + code access)
- [ ] REST API: clients, entries, code endpoint, trash, audit log
- [ ] Frontend: Login + Vault (live codes + countdown)
- [ ] Role-aware UI guards

### Phase 2 — Polish
- [ ] Manage view (full CRUD UI, QR import)
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
- `routes/entries.ts` — CRUD + soft-delete, assert `deleted_at` set correctly
- `middleware/rbac.ts` — All three roles against all permission boundaries
- `services/audit.ts` — Assert rows written on create/update/delete/code-access; assert no delete route exists

### Manual Verification
- Login flow against a real (or test) LDAP server
- Vault view: live codes tick, match a reference app (Aegis/Authy) for the same secret
- Viewer cannot access Manage/Trash routes (UI hidden + API returns 403)
- Editor cannot permanently delete from trash (UI hidden + API returns 403)
- Raw TOTP secret never appears in any API response or browser network tab
- Audit log: code access events appear after generating a code; diff field populated on edits
