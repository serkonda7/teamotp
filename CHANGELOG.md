# Changelog
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
