import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('login page loads', async ({ page }) => {
	await page.goto('/')

	await expect(page.locator('.login-card')).toBeVisible()
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
	await page.getByRole('button', { name: 'Zurück zur Übersicht' }).click()
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
	await page.getByRole('button', { name: 'Zurück zur Übersicht' }).click()
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

	// The clear button resets the filter
	await page.getByRole('button', { name: 'Zurücksetzen' }).click()
	await expect(arbeitChip).toHaveAttribute('aria-pressed', 'false')
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
	await page.getByRole('button', { name: 'Zurück zur Übersicht' }).click()
	await expect(filterButton.locator('.tag-filter__badge')).toHaveCount(0)
	await filterButton.click()
	await expect(page.locator('.tag-filter__chip')).toHaveCount(2)
	await expect(page.locator('.otp-list__item')).toHaveCount(3)

	// Delete the tag created here, leaving only the seeded one
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await page.getByRole('button', { name: 'Tag Privat löschen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(1)
})

test('theme toggle switches the theme and persists across reloads', async ({ page }) => {
	await login(page)

	const html = page.locator('html')
	const toggle = page.getByRole('button', { name: /Modus wechseln/ })

	const initialTheme = await html.getAttribute('data-theme')
	const toggledTheme = initialTheme === 'dark' ? 'light' : 'dark'

	await toggle.click()
	await expect(html).toHaveAttribute('data-theme', toggledTheme)

	// The chosen theme persists across reloads
	await page.reload()
	await expect(html).toHaveAttribute('data-theme', toggledTheme)

	await toggle.click()
	await expect(html).toHaveAttribute('data-theme', initialTheme)
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
