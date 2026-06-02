# Changelog
## unreleased
- Improvements
  - Add countdown bar indicating remaining time for shown codes
  - Add auto refresh for shown codes
  - Use icons on more buttons


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
