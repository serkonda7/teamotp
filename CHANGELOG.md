# Changelog
## unreleased

- New Feature: Audit log
  - Logs important actions
  - Default retention 90 days
  - Configurable via `audit.retentionDays`
- Improvements
  - Login: better error messages and banner design
- Bug Fixes
  - Prevent tag name collisions
  - Archived OTP entries no longer serve codes: `GET /otp/:id` now returns `410 Gone`


## 0.3.0
_2026-08-24_

### Breaking Changes
- Config: Rename `auth.jwtSecret` to `auth.appKey`
  - The deprecated alias will be removed in 0.4.0
- Normalize e-mails to lowercase
  - Run `cli.bin normalize-emails` once after upgrade
- Docker no longer publishes API on port 3000

### Other Changes
- Security improvements
  - Add config `disableLocalLogin` for hardening M365-only production deployments
  - Add `Secure` flag to session cookies
  - Rate-limit login endpoints per client IP (429 with `Retry-After`, configurable via `auth.loginRateLimit`)
  - Remove wildcard CORS: dev and prod are same-origin, cookies were only guarded by `SameSite`
  - Remove test-only config and DB branches from the production binary
- UI and UX
  - All dialogs can be closed with <kbd>Esc</kbd>
- Improvements
  - Config: Configurable listener (`server.host` / `server.port`; `TEAMOTP_PORT` env var still overrides)
  - Config validation errors now name the failing field paths
  - Redirect back to login page on M365 callback errors
- Technical
  - Update runtime to Bun 1.4.0


## 0.2.2
_2026-08-18_

- Security: Implement session timeouts
  - 4 hours without activity, or 5 days absolute
- Improvements
  - Data validation for request bodies
- Bug Fixes
  - Fix stale M365 login
  - Prevent override of unallowed fields during OTP update
  - Reject OTP updates that contain no fields
  - Reject invalid OTP secret values


## 0.2.1
_2026-07-26_

- UI: fix dark theme on microsoft login page
- Technical change: Add visual UI testing


## 0.2.0
_2026-07-25_

- New features
  - Dark theme
- UI and Layout improvmenets
  - Prevent layout shifts in tag filter popup
  - Fix layout shift in edit dialog with unsaved changes
- Improve keyboard navigation
  - Tabbing from entry search directly to first entry
  - Tabbing from tag search to tag name input
  - Tabbing through entries skips the edit and show buttons
  - Use arrow keys to reach those buttons
- Bug fixes
  - Correctly detect tag changes in edit dialog


## 0.1.0
_2026-07-21_

- Implement tags
  - Create tags with custom colors
  - Assign tags to OTP entries
  - Filter for specific tags


## 0.0.8
_2026-07-13_

- search bar UX improvements
  - Show keyboard shortcut too if out of focus
  - Select search text on refocus, so a new search text can be entered immediately


## 0.0.7
_2026-07-07_

- New Features
  - Add url param `search`
  - Add feature to archive entries
- UI improvements
  - Header with search sticks to top of page if scrolled down
  - Add entry form: Align style with application
  - Improve various UI parts for mobile phone displays
  - Search: focus with shortcut `Ctrl K`
- Other changes
  - Translate UI to german


## 0.0.6
_2026-07-01_

- New Features
  - Implement search bar
- UI improvements
  - About: Clearly mark external links
- Updater
  - Show release dates of current and target version
- Technical
  - Refactor config handling
  - Stricter typing and linting


## 0.0.5
_2026-06-13_

### Breaking Changes
- Remove list layout as there was no real use case since adding the responsive grid.

### Other Changes
- New Features:
  - Entry editing
- Improvements
  - Add countdown bar indicating remaining time for shown codes
  - Add auto refresh for shown codes
  - Use icons on more buttons
  - About: Include changelog link


## 0.0.4 - 2026-06-01
- New Features
  - Add grid layout and layout toggle
  - Default to grid layout due to better usage of screen space
  - Add button to show / hide code of single entries
- UI Improvements
  - Show notification toast on copy
  - login: no more layout shifts with M365 on expanding local login
  - Improve about dialog close button
  - Add app icon and favicon
- Fixes
  - About dialog: link can be selected
- Technical
  - Add e2e tests


## 0.0.3 - 2026-05-26
> Re-release of 0.0.2 with updater fixes

### Breaking Changes
- Change config load path to `server/data/config.toml` (previous: `server/config.toml`)

### Other Changes
- ui: improve OTP list visuals
  - Bigger text size
  - Separate lines for issuer and label
- Store and display both TOTP entry issuers if they are different
- ops: Add update script (`bun run infra/updater.ts`)
- readme: Mention Chrome extension to scan QRs on desktop
- backend/config: Add schema validation
- deps(all): replace ts-result with better-result


## 0.0.1 - 2026-05-22
Initial alpha-level release featuring:
- Login with local accounts or M365
- Adding TOTP codes by otpauth:// urls
