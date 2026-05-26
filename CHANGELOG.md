# Changelog
## 0.0.2 - unreleased
### Breaking Changes
- Change config load path to `server/data/config.toml` (previous: `server/config.toml`)

### Other Changes
- ui: improve OTP list visuals
  - Bigger text size
  - Separate lines for issuer and label
- ops: Add update script (`bun run infra/updater.ts`)
- backend/config: Add schema validation
- deps(all): replace ts-result with better-result


## 0.0.1 - 2026-05-22
Initial alpha-level release featuring:
- Login with local accounts or M365
- Adding TOTP codes by otpauth:// urls
