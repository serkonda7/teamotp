# Client UI/UX Review

> Scope: `client/src/*` review September 2026. Every item cites a file that exists today.
> Status convention: `[ ]` todo, `[x]` done. Keep this file updated when fixing items.

## High impact

**1. No focus management in modals** — `client/src/components/EditDialog.tsx:227-240`, `client/src/components/AboutDialog.tsx:50-58` — `[ ]`
- No focus trap: Tab escapes behind the backdrop while the dialog is open.
- Focus isn't moved into the dialog on open, nor returned to the trigger on close.
- Background content is only hidden from screen readers, not isolated from interaction (`aria-hidden` alone doesn't stop Tab/clicks). Require `inert` (or equivalent keyboard + pointer isolation) on background content while a modal is open — do not treat `aria-hidden` as an alternative to `inert`; keep `aria-hidden` supplemental only.
- Missing: scroll-lock (`body overflow hidden`), `aria-labelledby` pointing at heading id (both use `aria-label` instead), initial focus on first field/close button.
- Fix: small shared `<Modal>` component fixing all three; replaces duplicated backdrop/Escape/close code in both dialogs.

**2. Manual `tabindex={1..9}` sprinkled everywhere** — `client/src/components/SearchInput.tsx:47`, `client/src/components/OtpListItem.tsx:193,226,241`, `client/src/components/AddFromOtpauthForm.tsx:64,80`, `client/src/components/TagFilter.tsx:24,49,75`, `client/src/components/AppHeader.tsx:67,79,87,91,101`, `client/src/components/TagsPage.tsx:94,109,117,154`, `client/src/components/ThemeToggle.tsx:6,17` — `[ ]`
- Fragile, fights natural DOM order; every new control needs renumbering (tags/home toggle already causes branching tabindex values in `AppHeader.tsx:87-101`).
- `OtpListItem` tabs only to copy-card (`tabindex=2`), excludes edit/toggle (`tabindex=-1`) with custom ArrowLeft/Right (`OtpListItem.tsx:41-54`) — undiscoverable, no roving-tabindex announcement.
- Fix: remove all positive tabindexes (DOM order already matches visual order); make edit/toggle natively tabbable, keep arrows as enhancement with `role="group"` + instructions. Drop `tabindex` prop from `ThemeToggle`.

**3. Native `confirm()` for destructive / dirty checks** — `client/src/components/EditDialog.tsx:119,201-205`, `client/src/components/TagsPage.tsx:65` — `[ ]`
- Blocking, unstyled, i18n-hostile, not keyboard-consistent.
- Fix: custom confirm inside shared `<Modal>`, with destructive styling, `aria-modal`, explicit focus.

**4. Single global `error` string + non-live error regions** — `client/src/App.tsx:44,63,139,231-233`, `client/src/components/EditDialog.tsx:252-256`, `client/src/components/TagsPage.tsx:84-86`, `client/src/components/login/LoginPage.tsx:118-120,138-140` — `[ ]`
- One `error()` shared by tags/otps/add-form in `App.tsx`; overwritten, never dismissible, no retry. Regions lack `role="alert"` / `aria-live`.
- Fix: `role="alert"`, focus error on submit-fail, add dismiss button + "retry" where relevant (e.g. failed entry fetch). Separate errors per concern. Consider global toast: copy success uses per-item toast (`OtpListItem.tsx:255-259`) but failures go to page-top banner far from item.

**5. Login dead-ends while providers load / fail** — `client/src/components/login/LoginPage.tsx:16-26,54,141-149` — `[ ]`
- `fetchProviders` returns `undefined` on `!ok` or throw; `isProvidersKnown()` is false for both loading and error, rendering logo only with no spinner, no error, no retry.
- Fix: distinguish loading vs error, `role="status"` fallback + error state with retry button.

**6. Fragile auth bootstrap** — `client/src/App.tsx:124-131,267` — `[ ]`
- `onMount fetch('/api/auth/me')` failure leaves `isLoggedIn=false` vs error indistinguishable; fallback `<div>Laden...</div>` has no `role="status"`, no retry → network failure looks like logout or hangs.
- Fix: error state with retry, `role="status"` skeleton list.

**7. Abrupt idle logout, drops unsaved work** — `client/src/util/idle_timeout.ts:11,40-47`, `client/src/App.tsx:167-176,253-264` — `[ ]`
- `CHECK_INTERVAL_MS=60s` → logout up to 60s late; `clearSession()` wipes open `EditDialog` without confirm.
- Fix: 5–10s check + 60s warning banner with countdown + "stay logged in" (server ping), don't wipe dirty dialog without confirm.

## Medium

**8. TagFilter popover has no role, no keyboard trap** — `client/src/components/TagFilter.tsx:44-60,70-95,112-117` — `[ ]`
- Button has `aria-expanded` but no `aria-haspopup`/`aria-controls`; popover `div` has no `role="dialog"`, no focus move, no arrow-key nav between chips, Tab escapes popover. `right:0` (`tags.css:171-184`) can clip on mobile.
- Fix: `role="group"` + `aria-label`, focus first chip on open, trap Tab, `aria-controls` id, arrow-key nav like OTP items.

**9. OTP card copy pattern is an empty full-card `<button>`** — `client/src/components/OtpListItem.tsx:189-202`, `client/src/css/otp-list.css:76-110` — `[ ]`
- Huge click target (`inset:0`, `cursor:copy`) → accidental copies, no visible affordance; screen reader gets only `aria-label`; `disabled` while loading with no loading text.
- Fix: keep card clickable + add explicit visible copy icon-button, or add tooltip/hint text; `aria-live` busy while loading. Clipboard has no fallback (`OtpListItem.tsx:180-184` `navigator.clipboard` only) — add `execCommand('copy')` fallback with specific message for non-secure-context / denied permission.

**10. Code replaces label, timer has no text alternative** — `client/src/components/OtpListItem.tsx:205-209,260-264` — `[ ]`
- `{code() : label}` swaps context away; `ellipsis nowrap` (`otp-list.css:124-133`) truncates. Timer track is `aria-hidden` only.
- Fix: keep `label` always, show code second line/larger; `title` + click-to-select; `aria-live="polite"` code region + text alternative for timer.

**11. Hover-only edit affordance** — `client/src/css/otp-list.css:192-208` — `[ ]`
- `.otp-list__edit{opacity:0}` on `hover:hover`, shown only on hover/focus-within/touch. Opacity-only hide fails discoverability/contrast.
- Fix: always visible at reduced opacity (`0.6→1` on hover), keep keyboard/touch visible.

**12. Tag contrast can fail — white on arbitrary user color** — `client/src/css/tags.css:133-137,239-244`, `client/src/components/TagsPage.tsx:11` — `[ ]`
- `.tag-filter__chip--active` / `.edit-tags__option--assigned` use `background:var(--tag-color); color:#fff`; default `#16a34a` with white ≈3.3:1.
- Fix: compute luminance in JS, toggle `#fff`/`#111`, or `color-mix` border + dark text; add `forced-colors` support.

**13. Forms missing labels, help, and inline errors**
- `AddFromOtpauthForm.tsx:60-75`: icon-less, only `placeholder` + `aria-label`; `type="text"` should be `type="url"` + `inputmode="url"`; no clear/paste button, no example/help, error via distant `App.tsx:231` region. Fix: visible `<label>`, inline error `aria-describedby`, disable submit when empty.
- `SearchInput.tsx:52-59`: `onFocus select()` + `autofocus` steal focus / reselect on every Tab-in. `Ctrl+K` (`17-31`) no-ops inside inputs; `kbd` always shows "Strg K" even on touch. Fix: remove autofocus/select, hide `kbd` on `pointer:coarse`, add `aria-keyshortcuts`, clear button for `type="search"`.
- `EditDialog.tsx:29-31`: `Asterisk` `<span>* </span>` announced as "star", `visible=false` reserves space but stays in a11y tree. Fix: `aria-hidden="true"` + `aria-describedby`. Tags section (`EditDialog.tsx:65-84,291`) has no loading skeleton; hidden entirely when zero — add "Noch keine Tags — [Tags verwalten]" link + error state. `class="login-form"` (`EditDialog.tsx:258`) reuses login styles — extract shared `.form-stack`. `form-actions` (`modal.css:104-150`) cramped at 320px with absolute archive — wrap to column `<380px`.
- `TagsPage.tsx:88-120`: `type="color"` has no text hex fallback, no duplicate-name check. Fix: sync text input + `aria-describedby`, client duplicate warning.
- `LoginPage.tsx:97-123`: missing `autocomplete="username"/"current-password"`, `name`, `aria-invalid`/`aria-describedby`, `aria-busy` on submit; no show-password toggle.
- `MicrosoftSignInSection.tsx:14-16,26,29`: `onMount focus()` steals focus, invalid `autofocus` on `<a>`, `img alt="Microsoft-Logo"` redundant. Fix: autofocus only when sole provider, `alt=""`.

**14. Search / filter / list empty + loading states**
- `OtpList.tsx:18`: `fallback={<div>Laden...</div>}` no skeleton/count. Combined search+tag case (`23-35`) only mentions search, no result count, no "Suche löschen" / "Filter zurücksetzen" button. Fix: `role="status" aria-live`, count, clear actions.
- `TagsPage.tsx:36-37,122`: `filteredTags()` no count announcement, no clear-search.
- `App.tsx:97-122`: search↔URL sync via `replaceState` every keystroke, no debounce; `popstate` (back) doesn't restore `searchQuery`. Fix: debounce ~150ms, `popstate` listener restoring query.

**15. Navigation / routing / header**
- `router.ts:4,13-19`: `window.location.pathname` at module scope (SSR/test-unsafe); `navigate` drops `?search`; strict `path()==='/tags'` (`App.tsx:185,211`, `AppHeader.tsx:41,62`) fails for `/tags/` or query. No `document.title`, no scroll-to-top, no `aria-current`. Fix: normalize trailing slash, preserve query opt, set title, focus `h1`/`h2`.
- `AppHeader.tsx:36-38`: logo `div` not link — no home affordance. Fix: `<a href="/" onClick={navigate}>` or button.
- `AppHeader.tsx:98-107` + `App.tsx:146-155`: logout instant `POST`, no confirm; red outline always (`header.css:44-55`). Fix: confirm or undo.
- `AppHeader.tsx:28-59` + `header.css:57-80`: mobile wraps search full-width with `max-width:24rem` leaving right gap. Fix: `max-width:none` on mobile.

**16. Visual / CSS consistency**
- Inputs use border-color-only focus (`search-input.css:29-32`, `add-entry.css:20-23` `outline:none`) vs `.icon-button:focus-visible` outline (`styles.css:87-90`). Fix: 2px `outline` + `outline-offset` everywhere.
- Dirty indicator italic-only (`modal.css:57-74`, `tags.css:106-114`) fails WCAG 1.4.1. Fix: add icon/bold/border + `aria` text "(geändert)".
- `.login-button:hover` (`login.css:36-55`), `add-entry.css:37-46` lack `:focus-visible` / `:disabled` styles. Fix: shared `.btn-primary` with focus ring.
- `styles.css:44-46` `a[target=_blank]::after{content:"↗"}` not `aria-hidden`; `AboutDialog.tsx:13-18,25-30` uses `rel="noreferrer"` without `noopener`. Fix: `rel="noreferrer noopener"`, visual-only indicator + `aria-label "(öffnet in neuem Tab)"`.
- `AboutDialog.tsx:10-22` hardcoded `Version 0.4.0` + `#040` anchor — stale on release. Fix: import from `package.json` / generated `__APP_VERSION__`.
- Global `form` selector (`styles.css:26-31`) leaks into login/tags/edit; `add-entry.css:1-4` overrides it. Fix: scope to classes.
- `login.css:68-76` vs `add-entry.css:49-58` (`login-error` vs `app-inline-error`) + `otp-list__empty`/`tag-list__empty` duplicate — extract shared `Alert`/`EmptyState`.
- `EditDialog` + `AboutDialog` backdrop/dismiss/close/Escape duplication → shared `Modal` (see High #1).

## Low / polish

- **Search debounce missing** — every keystroke rewrites history state (`App.tsx:96-121`); harmless with `replaceState` but filtering large lists per keystroke could use a ~150ms debounce.
- `OtpListItem.tsx:56-62` `scrollIntoView({behavior:'smooth'})` no `prefers-reduced-motion` guard. Fix: `matchMedia('(prefers-reduced-motion: reduce)')` → `auto`.
- `OtpListItem.tsx:116-138` timer re-created on every visibility change; `refreshVisibleCode` race guarded by bool, not abortable. Consider `AbortController`.
- `util/theme.ts:8,25,35` `localStorage` throws in private mode; `addEventListener('change')` needs `addListener` fallback for old Safari. Wrap in try/catch.
- `api.ts:52` success `await res.json()` throws on empty body (vs `read_api_error` in `util/api_error.ts:4` which catches). Fix: `.catch(()=>null)`.
- `util/api_error.ts:6-7` `'error' in data` + `String(...)` may stringify objects as `[object Object]`. Narrow to string.
- `App.tsx:67` `sort((a,b)=>a.name.localeCompare(b.name))` without locale — pass `'de'` for stable umlaut order.
- `AboutDialog.tsx:58` `aria-label="TeamOTP"` + `h2` logo duplicate; prefer `aria-labelledby` heading id.
- `microsoft-login.css:40` `text-decoration:none` + no explicit `:focus-visible` ring. Add 2px outline.
- `tags.css:43-51` color swatch has no visible focus ring beyond default — add `:focus-visible` outline.
- `TagFilter.tsx:18-19` `createMemo(props.isActive)` wrapping getter unnecessary — call directly.
- `forms.css:8-11` `label{color:muted}` (`color-mix(ink 72%,white)`) — verify 4.5:1 on white.
