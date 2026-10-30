import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('login page loads', async ({ page }) => {
	await page.goto('/')

	await expect(page.locator('.login-card')).toBeVisible()
})

test('search is focused after login', async ({ page }) => {
	await login(page)

	await expect(page.getByLabel('Einträge suchen')).toBeFocused()
})

test('tags can be created, assigned, filtered and deleted', async ({ page }) => {
	await login(page)

	// Navigate to the tags page, which starts with the seeded tag
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page).toHaveURL(/\/tags$/)
	await expect(page.locator('.tag-list__item')).toHaveCount(1)

	// Create a tag
	await page.getByLabel('Name').fill('Arbeit')
	await page.getByLabel('Farbe').fill('#3b82f6')
	await page.getByRole('button', { name: 'Erstellen' }).click()

	await expect(page.locator('.tag-list__item')).toHaveCount(2)
	const tagItem = page.locator('.tag-list__item', { hasText: 'Arbeit' })
	await expect(tagItem.locator('.tag-chip')).toHaveText('Arbeit')
	await expect(tagItem.locator('.tag-list__count')).toHaveText('0 Einträge')

	// Assign the tag in the entry edit dialog
	await page.getByRole('link', { name: 'Übersicht' }).click()
	await expect(page).toHaveURL(/\/$/)
	await page.getByRole('button', { name: 'Eintrag für test bearbeiten' }).click()
	const tagOption = page.locator('.edit-tags__option', { hasText: 'Arbeit' })
	await expect(tagOption).toBeVisible()
	await tagOption.click()
	await expect(tagOption.locator('input')).toBeChecked()

	// Tag changes are pending until saved; the chip appears and the member count increases
	await page.getByRole('button', { name: 'Speichern' }).click()
	const testEntry = page.locator('.otp-list__item', { hasText: 'period-5-seconds' })
	await expect(testEntry.locator('.otp-list__tags .tag-chip')).toHaveText('Arbeit')

	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(tagItem.locator('.tag-list__count')).toHaveText('1 Eintrag')

	// Create a second, unassigned tag
	await page.getByLabel('Name').fill('Privat')
	await page.getByRole('button', { name: 'Erstellen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(3)

	// The overview page shows a filter chip per tag inside the filter popover
	await page.getByRole('link', { name: 'Übersicht' }).click()
	const filterButton = page.getByRole('button', { name: 'Nach Tags filtern' })
	const arbeitChip = page.locator('.tag-filter__chip', { hasText: 'Arbeit' })
	const privatChip = page.locator('.tag-filter__chip', { hasText: 'Privat' })

	await filterButton.click()
	await expect(page.locator('.tag-filter__chip')).toHaveCount(3)

	// Filtering by the unassigned tag hides every entry
	await privatChip.click()
	await expect(privatChip).toHaveAttribute('aria-pressed', 'true')
	await expect(filterButton.locator('.tag-filter__badge')).toHaveText('1')
	await expect(page.locator('.otp-list__item')).toHaveCount(0)
	await expect(page.getByText('Keine Einträge passen zum gewählten Tag-Filter.')).toBeVisible()

	// Deselecting the tag shows the entries again
	await privatChip.click()
	await expect(page.locator('.otp-list__item')).toHaveCount(3)

	// Filtering by the assigned tag keeps only its entry visible
	await arbeitChip.click()
	await expect(arbeitChip).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.otp-list__item')).toHaveCount(1)

	// Applied filters show as removable pills; a single one has no "clear all" button
	const activeFilters = page.getByRole('list', { name: 'Aktive Tag-Filter' })
	await expect(activeFilters.getByRole('button', { name: 'Alle entfernen' })).toHaveCount(0)
	await activeFilters.getByRole('button', { name: 'Filter "Arbeit" entfernen' }).click()
	await expect(filterButton.locator('.tag-filter__badge')).toHaveCount(0)
	await expect(page.locator('.otp-list__item')).toHaveCount(3)

	// With several filters, "Alle entfernen" resets them at once. Clicking a pill
	// counts as an outside click and closes the popover, so reopen it.
	await filterButton.click()
	await arbeitChip.click()
	await privatChip.click()
	await expect(filterButton.locator('.tag-filter__badge')).toHaveText('2')
	await activeFilters.getByRole('button', { name: 'Alle entfernen' }).click()
	await expect(filterButton.locator('.tag-filter__badge')).toHaveCount(0)
	await filterButton.click()
	await expect(arbeitChip).toHaveAttribute('aria-pressed', 'false')
	await expect(privatChip).toHaveAttribute('aria-pressed', 'false')
	await expect(filterButton.locator('.tag-filter__badge')).toHaveCount(0)
	await expect(page.locator('.otp-list__item')).toHaveCount(3)

	// Escape closes the popover
	await page.keyboard.press('Escape')
	await expect(page.locator('.tag-filter__popover')).toHaveCount(0)

	// Delete the selected tag
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	page.on('dialog', (dialog) => dialog.accept())
	await page.getByRole('button', { name: 'Tag Arbeit löschen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(2)

	// The deleted tag disappears from the filter and is deselected
	await page.getByRole('link', { name: 'Übersicht' }).click()
	await expect(filterButton.locator('.tag-filter__badge')).toHaveCount(0)
	await filterButton.click()
	await expect(page.locator('.tag-filter__chip')).toHaveCount(2)
	await expect(page.locator('.otp-list__item')).toHaveCount(3)

	// Delete the tag created here, leaving only the seeded one
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await page.getByRole('button', { name: 'Tag Privat löschen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(1)
})

test('clicking the same entry again after 5 seconds copies a fresh code', async ({
	context,
	page,
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write'])

	await login(page)

	const copyButton = page.getByRole('button', { name: 'OTP-Code für Test kopieren' })
	await expect(copyButton).toBeVisible()

	await copyButton.click()
	await expect(page.getByRole('status')).toHaveText('Kopiert!')
	const firstCode = await page.evaluate(() => navigator.clipboard.readText())

	await page.waitForTimeout(5000)

	await copyButton.click()
	await expect(page.getByRole('status')).toHaveText('Kopiert!')
	const secondCode = await page.evaluate(() => navigator.clipboard.readText())

	expect(secondCode).not.toBe(firstCode)
})

test('entry search stays in the URL across pages and reloads', async ({ page }) => {
	await login(page)

	const search = page.getByLabel('Einträge suchen')
	await search.pressSequentially('period-5')
	await expect(search).toHaveValue('period-5')
	await expect(page).toHaveURL(/[?&]search=/)
	await expect(page.locator('.otp-list__item')).toHaveCount(1)

	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page).toHaveURL(/\/tags\?search=/)

	// The breadcrumb link comes right after the search in the tab order
	const breadcrumbLink = page.getByRole('link', { name: 'Übersicht' })
	await page.getByLabel('Tags suchen').focus()
	await page.keyboard.press('Tab')
	await expect(breadcrumbLink).toBeFocused()

	await breadcrumbLink.click()
	await expect(search).toHaveValue('period-5')

	await page.reload()
	await expect(page.getByLabel('Einträge suchen')).toHaveValue('period-5')
	await expect(page.locator('.otp-list__item')).toHaveCount(1)

	await page.getByLabel('Einträge suchen').clear()
	await expect(page).not.toHaveURL(/search=/)
})

test('oauth error from the callback redirect is shown once', async ({ page }) => {
	await page.goto('/?error=expired_state')

	await expect(page.locator('.login-error')).toHaveText('Anmeldung abgelaufen.')
	await expect(page).not.toHaveURL(/error=/)
})

test('unknown paths fall back to the entry list', async ({ page }) => {
	await login(page)
	await expect(page.locator('.otp-list__item').first()).toBeVisible()

	await page.goto('/does-not-exist')

	await expect(page.locator('.otp-list__item').first()).toBeVisible()
	await expect(page).toHaveURL(/\/$/)
})

test('logout clears the session view and login loads it again', async ({ page }) => {
	await login(page)
	await page.getByLabel('Einträge suchen').fill('period')
	await expect(page).toHaveURL(/search=/)

	await page.getByRole('button', { name: 'Abmelden' }).click()
	await expect(page.locator('.login-card')).toBeVisible()
	await expect(page.getByLabel('E-Mail')).toBeVisible()
	await expect(page).not.toHaveURL(/search=/)

	await login(page)
	await expect(page.getByLabel('Einträge suchen')).toHaveValue('')
	await expect(page.locator('.otp-list__item').first()).toBeVisible()
})

test('a new entry appears and receives focus without a reload', async ({ page }) => {
	await login(page)
	await expect(page.locator('.otp-list__item').first()).toBeVisible()
	const before = await page.locator('.otp-list__item').count()

	await page
		.getByLabel('OTPAuth URL')
		.fill('otpauth://totp/Fresh:new-entry?secret=JBSWY3DPEHPK3PXP&issuer=Fresh')
	await page.getByRole('button', { name: 'Neuer Eintrag' }).click()

	const items = page.locator('.otp-list__item')
	await expect(items).toHaveCount(before + 1)
	await expect(page.getByLabel('OTPAuth URL')).toHaveValue('')
	const entry = items.filter({ hasText: 'new-entry' })
	await expect(entry.locator(':focus')).toHaveCount(1)

	// The visual tests assert against the seeded entries
	page.once('dialog', (dialog) => dialog.accept())
	await page.getByRole('button', { name: 'Eintrag für Fresh bearbeiten' }).click()
	await page.getByRole('button', { name: 'Archivieren' }).click()
	await expect(items).toHaveCount(before)
})
