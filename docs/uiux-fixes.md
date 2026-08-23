# Client UI/UX Review

Solid foundation overall — good aria-labels (German), dark mode, empty states, keyboard roving in list items, and URL-persisted search. Findings by priority:

## High impact

**1. Native `confirm()` for destructive actions** — `client/src/components/EditDialog.tsx:119`, `EditDialog.tsx:189`, `client/src/components/TagsPage.tsx:65`
Blocking browser dialogs look jarring, aren't themeable, and can't be styled for your design system. Replace with an in-app confirmation dialog component (you already have modal CSS/patterns to reuse).

**2. No focus management in modals** — `client/src/components/EditDialog.tsx:214-350`, AboutDialog
- No focus trap: Tab escapes behind the backdrop while the dialog is open.
- Focus isn't moved into the dialog on open, nor returned to the trigger on close.
- Background content is only hidden from screen readers, not isolated from interaction (`aria-hidden` alone doesn't stop Tab/clicks). Require `inert` (or equivalent keyboard + pointer isolation) on background content while a modal is open — do not treat `aria-hidden` as an alternative to `inert`; keep `aria-hidden` supplemental only.

A small shared `<Modal>` component fixing all three would replace the duplicated backdrop code in both dialogs.

**3. Escape doesn't close dialogs** — `client/src/components/EditDialog.tsx`
The TagFilter popover handles Escape (`TagFilter.tsx:112-117`) but neither `EditDialog` nor `AboutDialog` does. Users expect Esc = cancel everywhere.

**4. Copy is discoverable only via hover/title** — `client/src/components/OtpListItem.tsx:179-192`
The whole card is a copy button but nothing visually indicates it until hover; on touch devices there's no hint at all. Consider showing a copy affordance/icon inside the card, and making it work via keyboard Enter (it does, since it's a button — good).

## Medium

**5. Loading states are bare text** — `client/src/App.tsx:194`, `OtpList.tsx:16`, `TagsPage.tsx:122`
"Laden..." causes layout jumps. Skeleton cards matching the OTP grid shape would feel much smoother.

**6. Error banners never dismiss and have no recovery** — `client/src/App.tsx:240-242`
Inline errors persist until another action clears them. Add a dismiss button and a "retry" action where relevant (e.g., failed entry fetch). Also no global toast system — copy success uses per-item toast but failures go to a separate banner at page top, far from the item.

**7. `prefers-reduced-motion` not respected**
Timer bar animation, header shadow transitions etc. run unconditionally. Add:

```css
@media (prefers-reduced-motion: reduce) {
	* {
		animation: none;
		transition: none;
	}
}
```

(at minimum for the countdown bar).

**8. Manual `tabindex={1..9}` sprinkled everywhere** — `client/src/components/AppHeader.tsx:67-101`, TagFilter, OtpListItem
This is fragile and fights the natural DOM order; every new control needs renumbering (the tags/home toggle already causes branching tabindex values). Remove positive tabindexes entirely — DOM order already matches visual order here.

**9. Archive button placement/risk** — `client/src/components/EditDialog.tsx:338-345`
"Archivieren" sits directly next to "Abbrechen"/"Speichern" in the same row as the primary action. Move destructive actions away from primary ones (separate row/left-aligned, danger styling).

## Low / polish

- **No i18n layer** — German strings hardcoded across ~10 components. Fine if German-only forever, painful otherwise.
- **Search debounce missing** — every keystroke rewrites history state (`App.tsx:96-121`); harmless with `replaceState` but filtering large lists per keystroke could use a ~150ms debounce.
- **Tag filter popover has no role** — consider `role="group"` + `aria-label`, and arrow-key navigation between chips like the OTP items have.
- **Copy toast position** — appears per-item which is good, but 1400ms is short for screen reader users despite `aria-live`; consider 2–3s.
- **Session-expired flow is nice**, but after idle logout the search input autofocus steals focus on the login page — verify that's intended.
- **`otp-list__copy` disabled during load** (`OtpListItem.tsx:191`): disabling removes the focused control from tab order mid-interaction — but only the control that is *focused* when it becomes disabled is affected. Do not replace `disabled` with `aria-busy` alone: `aria-busy` does not block activation. Keep `disabled` on controls that must not activate, or use `aria-disabled` paired with explicit guards in every affected handler.

## Suggested first pass

Shared `<Modal>` with focus trap + Esc handling (#2/#3), then replacing `confirm()` with an in-app dialog (#1).
