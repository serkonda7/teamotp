# Client UI/UX Review
## High impact

**2. No focus management in modals** — `client/src/components/EditDialog.tsx:214-350`, AboutDialog
- No focus trap: Tab escapes behind the backdrop while the dialog is open.
- Focus isn't moved into the dialog on open, nor returned to the trigger on close.
- Background content is only hidden from screen readers, not isolated from interaction (`aria-hidden` alone doesn't stop Tab/clicks). Require `inert` (or equivalent keyboard + pointer isolation) on background content while a modal is open — do not treat `aria-hidden` as an alternative to `inert`; keep `aria-hidden` supplemental only.

A small shared `<Modal>` component fixing all three would replace the duplicated backdrop code in both dialogs.

## Medium

**6. Error banners never dismiss and have no recovery** — `client/src/App.tsx:240-242`
Inline errors persist until another action clears them. Add a dismiss button and a "retry" action where relevant (e.g., failed entry fetch). Also no global toast system — copy success uses per-item toast but failures go to a separate banner at page top, far from the item.

**8. Manual `tabindex={1..9}` sprinkled everywhere** — `client/src/components/AppHeader.tsx:67-101`, TagFilter, OtpListItem
This is fragile and fights the natural DOM order; every new control needs renumbering (the tags/home toggle already causes branching tabindex values). Remove positive tabindexes entirely — DOM order already matches visual order here.

**9. Archive button placement/risk** — `client/src/components/EditDialog.tsx:338-345`
"Archivieren" sits directly next to "Abbrechen"/"Speichern" in the same row as the primary action. Move destructive actions away from primary ones (separate row/left-aligned, danger styling).

## Low / polish

- **Search debounce missing** — every keystroke rewrites history state (`App.tsx:96-121`); harmless with `replaceState` but filtering large lists per keystroke could use a ~150ms debounce.
- **Tag filter popover has no role** — consider `role="group"` + `aria-label`, and arrow-key navigation between chips like the OTP items have.
