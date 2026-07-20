import { expect, type Page, test } from '@playwright/test'

test('login page loads', async ({ page }) => {
	await page.goto('/')

	await expect(page.locator('.login-card')).toBeVisible()
})

async function login(page: Page): Promise<void> {
	await page.goto('/')
	const useLocalAccount = page.getByText('Lokales Konto verwenden')
	if ((await useLocalAccount.count()) > 0) {
		await useLocalAccount.click()
	}
	await page.getByLabel('E-Mail').fill('e2e@test.com')
	await page.getByLabel('Passwort').fill('e2e-password')
	await page.getByRole('button', { name: 'Anmelden' }).click()
}

test('tags can be created, assigned, filtered and deleted', async ({ page }) => {
	await login(page)

	// Navigate to the tags page
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page).toHaveURL(/\/tags$/)
	await expect(page.getByText('Keine Tags vorhanden.')).toBeVisible()

	// Create a tag
	await page.getByLabel('Name').fill('Arbeit')
	await page.getByLabel('Farbe').fill('#3b82f6')
	await page.getByRole('button', { name: 'Erstellen' }).click()

	const tagItem = page.locator('.tag-list__item')
	await expect(tagItem).toHaveCount(1)
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

	// Chip appears on the entry and the member count increases
	await page.getByRole('button', { name: 'Abbrechen' }).click()
	await expect(page.locator('.otp-list__tags .tag-chip')).toHaveText('Arbeit')

	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page.locator('.tag-list__count')).toHaveText('1 Eintrag')

	// Create a second, unassigned tag
	await page.getByLabel('Name').fill('Privat')
	await page.getByRole('button', { name: 'Erstellen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(2)

	// The overview page shows a filter chip per tag
	await page.getByRole('button', { name: 'Zurück zur Übersicht' }).click()
	const arbeitChip = page.locator('.tag-filter-bar__chip', { hasText: 'Arbeit' })
	const privatChip = page.locator('.tag-filter-bar__chip', { hasText: 'Privat' })
	await expect(page.locator('.tag-filter-bar__chip')).toHaveCount(2)

	// Filtering by the unassigned tag hides the entry
	await privatChip.click()
	await expect(privatChip).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.otp-list__item')).toHaveCount(0)
	await expect(page.getByText('Keine Einträge passen zum gewählten Tag-Filter.')).toBeVisible()

	// Deselecting the tag shows the entry again
	await privatChip.click()
	await expect(page.locator('.otp-list__item')).toHaveCount(1)

	// Filtering by the assigned tag keeps the entry visible
	await arbeitChip.click()
	await expect(arbeitChip).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.otp-list__item')).toHaveCount(1)

	// Delete the selected tag
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	page.on('dialog', (dialog) => dialog.accept())
	await page.getByRole('button', { name: 'Tag Arbeit löschen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(1)

	// The deleted tag disappears from the filter bar and is deselected
	await page.getByRole('button', { name: 'Zurück zur Übersicht' }).click()
	await expect(page.locator('.tag-filter-bar__chip')).toHaveCount(1)
	await expect(page.locator('.otp-list__item')).toHaveCount(1)

	// Delete the remaining tag
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await page.getByRole('button', { name: 'Tag Privat löschen' }).click()
	await expect(page.getByText('Keine Tags vorhanden.')).toBeVisible()
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
