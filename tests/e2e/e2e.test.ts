import { expect, type Page, test } from '@playwright/test'
import { login } from './helpers'

const SCANNED_URL = 'otpauth://totp/Scanned:qr-entry?secret=JBSWY3DPEHPK3PXP&issuer=Scanned'

/** Headless Chromium has no BarcodeDetector, so every frame "contains" `raw`. */
async function fake_barcode_detector(page: Page, raw: string | null): Promise<void> {
	await page.addInitScript((value) => {
		class FakeBarcodeDetector {
			static getSupportedFormats = async (): Promise<string[]> => ['qr_code']
			detect = async (): Promise<{ rawValue: string }[]> =>
				value ? [{ rawValue: value }] : []
		}
		Object.assign(globalThis, { BarcodeDetector: FakeBarcodeDetector })
	}, raw)
}

async function fake_camera(page: Page): Promise<void> {
	await page.addInitScript(() => {
		navigator.mediaDevices.getUserMedia = async (): Promise<MediaStream> => {
			const canvas = document.createElement('canvas')
			canvas.getContext('2d')
			return canvas.captureStream()
		}
	})
}

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
	await expect(page.getByRole('button', { name: 'Tags verwalten' })).toHaveText('Tags')
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page).toHaveURL(/\/tags$/)
	await expect(page.locator('.tag-list__item')).toHaveCount(1)

	// Create a tag
	await page.getByLabel('Name').fill('Arbeit')
	const color = page.getByLabel('Farbe', { exact: true })
	const colorPicker = page.getByLabel('Farbe auswählen')
	await expect(color).toHaveValue('#16a34a')
	await page.getByLabel('Name').focus()
	await page.keyboard.press('Tab')
	await expect(colorPicker).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(color).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(page.getByRole('button', { name: 'Erstellen' })).toBeFocused()
	await color.fill('invalid')
	await color.blur()
	await expect(color).toHaveValue('#16a34a')
	await colorPicker.fill('#112233')
	await expect(color).toHaveValue('#112233')
	await color.fill('#3b82f6')
	await page.getByRole('button', { name: 'Erstellen' }).click()

	await expect(page.locator('.tag-list__item')).toHaveCount(2)
	const tagItem = page.locator('.tag-list__item', { hasText: 'Arbeit' })
	await expect(tagItem.locator('.tag-chip')).toHaveText('Arbeit')
	await expect(tagItem.locator('.tag-chip')).toHaveAttribute('style', /#3b82f6/)
	await expect(tagItem.locator('.tag-list__count')).toHaveText('0 Einträge')
	await expect(color).toHaveValue('#16a34a')

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
	await color.fill('abc')
	await color.press('Enter')
	await expect(page.locator('.tag-list__item')).toHaveCount(3)
	await expect(
		page.locator('.tag-list__item', { hasText: 'Privat' }).locator('.tag-chip'),
	).toHaveAttribute('style', /#aabbcc/)
	await expect(color).toHaveValue('#16a34a')

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

test('tags can be edited', async ({ page }) => {
	await login(page)
	await page.getByRole('button', { name: 'Tags verwalten' }).click()

	await page.getByLabel('Name').fill('Entwurf')
	await page.getByRole('button', { name: 'Erstellen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(2)

	await page.getByRole('button', { name: 'Tag Entwurf bearbeiten' }).click()
	const dialog = page.getByRole('dialog', { name: 'Tag bearbeiten' })
	await expect(dialog.getByLabel('Name')).toHaveValue('Entwurf')

	await dialog.getByLabel('Name').fill('Final')
	const color = dialog.getByLabel('Farbe', { exact: true })
	await color.fill('ABC')
	await color.blur()
	await expect(color).toHaveValue('#aabbcc')
	await expect(dialog.getByLabel('Farbe auswählen')).toHaveValue('#aabbcc')
	await expect(dialog.locator('label[for="edit-tag-color"]')).toHaveClass(/field-changed/)
	await dialog.getByLabel('Farbe auswählen').fill('#3b82f6')
	await expect(color).toHaveValue('#3b82f6')
	await dialog.getByRole('button', { name: 'Speichern' }).click()

	await expect(dialog).toHaveCount(0)
	const tagChip = page.locator('.tag-list__item .tag-chip', { hasText: 'Final' })
	await expect(tagChip).toBeVisible()
	await expect(tagChip).toHaveAttribute('style', /#3b82f6/)
	await expect(page.locator('.tag-list__item', { hasText: 'Entwurf' })).toHaveCount(0)

	// Clean up, leaving only the seeded tag
	page.on('dialog', (confirmDialog) => confirmDialog.accept())
	await page.getByRole('button', { name: 'Tag Final löschen' }).click()
	await expect(page.locator('.tag-list__item')).toHaveCount(1)
})

test('closing the edit dialog asks before discarding changes', async ({ page }) => {
	await login(page)
	await page.getByRole('button', { name: 'Eintrag für test bearbeiten' }).click()
	const dialog = page.getByRole('dialog', { name: 'Eintrag bearbeiten' })

	// Without changes there is nothing to confirm
	await page.keyboard.press('Escape')
	await expect(dialog).toHaveCount(0)

	await page.getByRole('button', { name: 'Eintrag für test bearbeiten' }).click()
	await dialog.getByLabel('Konto').fill('changed')

	page.once('dialog', (confirmDialog) => confirmDialog.dismiss())
	await page.keyboard.press('Escape')
	await expect(dialog).toBeVisible()

	page.once('dialog', (confirmDialog) => confirmDialog.dismiss())
	await page.mouse.click(5, 5)
	await expect(dialog).toBeVisible()
	await expect(dialog.getByLabel('Konto')).toHaveValue('changed')

	page.once('dialog', (confirmDialog) => confirmDialog.accept())
	await dialog.getByRole('button', { name: 'Abbrechen' }).click()
	await expect(dialog).toHaveCount(0)
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

	const logoutButton = page.getByRole('button', { name: 'Abmelden' })
	await expect(logoutButton).toHaveText('')
	await logoutButton.click()
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
	await page.getByRole('button', { name: 'Anlegen' }).click()

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

test.describe('touch devices', () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } })

	test('the floating button replaces the form and scans a new entry', async ({ page }) => {
		await fake_barcode_detector(page, SCANNED_URL)
		await fake_camera(page)
		await login(page)
		await expect(page.locator('.otp-list__item').first()).toBeVisible()
		const before = await page.locator('.otp-list__item').count()

		await expect(page.getByLabel('OTPAuth URL')).toBeHidden()
		await expect(page.getByRole('button', { name: 'Anlegen' })).toBeHidden()

		await page.getByRole('button', { name: 'QR-Code scannen' }).click()

		const items = page.locator('.otp-list__item')
		await expect(items).toHaveCount(before + 1)
		await expect(page.getByRole('dialog', { name: 'QR-Code scannen' })).toHaveCount(0)

		// The visual tests assert against the seeded entries
		page.once('dialog', (dialog) => dialog.accept())
		await page.getByRole('button', { name: 'Eintrag für Scanned bearbeiten' }).click()
		await page.getByRole('button', { name: 'Archivieren' }).click()
		await expect(items).toHaveCount(before)
	})

	test('a browser without BarcodeDetector adds entries by URL in the dialog', async ({
		page,
	}) => {
		await page.addInitScript(() => {
			Reflect.deleteProperty(globalThis, 'BarcodeDetector')
		})
		await login(page)
		await expect(page.locator('.otp-list__item').first()).toBeVisible()
		const before = await page.locator('.otp-list__item').count()

		await page.getByRole('button', { name: 'QR-Code scannen' }).click()
		const dialog = page.getByRole('dialog', { name: 'QR-Code scannen' })
		await expect(dialog.getByText('nicht unterstützt')).toBeVisible()

		const inputBox = await dialog.getByLabel('OTPAuth URL').boundingBox()
		const buttonBox = await dialog.getByRole('button', { name: 'Anlegen' }).boundingBox()
		expect(buttonBox?.y).toBeGreaterThanOrEqual((inputBox?.y ?? 0) + (inputBox?.height ?? 0))
		expect(buttonBox?.width).toBe(inputBox?.width)

		// A failed attempt stays in the dialog, where the error is visible
		await dialog.getByLabel('OTPAuth URL').fill('not-a-url')
		await dialog.getByRole('button', { name: 'Anlegen' }).click()
		await expect(dialog.getByText('Please enter a valid URL')).toBeVisible()

		await dialog.getByLabel('OTPAuth URL').fill(SCANNED_URL)
		await dialog.getByRole('button', { name: 'Anlegen' }).click()
		await expect(dialog).toHaveCount(0)

		const items = page.locator('.otp-list__item')
		await expect(items).toHaveCount(before + 1)

		// The visual tests assert against the seeded entries
		page.once('dialog', (confirmDialog) => confirmDialog.accept())
		await page.getByRole('button', { name: 'Eintrag für Scanned bearbeiten' }).click()
		await page.getByRole('button', { name: 'Archivieren' }).click()
		await expect(items).toHaveCount(before)
	})

	test('a denied camera permission is shown in the scanner', async ({ page }) => {
		await fake_barcode_detector(page, null)
		await page.addInitScript(() => {
			navigator.mediaDevices.getUserMedia = (): Promise<MediaStream> =>
				Promise.reject(new DOMException('denied', 'NotAllowedError'))
		})
		await login(page)

		await page.getByRole('button', { name: 'QR-Code scannen' }).click()
		const dialog = page.getByRole('dialog', { name: 'QR-Code scannen' })
		await expect(dialog.getByText('Kamerazugriff wurde verweigert.')).toBeVisible()
		await expect(dialog.getByLabel('OTPAuth URL')).toBeVisible()

		await dialog.getByRole('button', { name: 'Dialog schließen' }).click()
		await expect(dialog).toHaveCount(0)
	})
})

test('the floating button stays hidden with a mouse', async ({ page }) => {
	await login(page)

	await expect(page.getByLabel('OTPAuth URL')).toBeVisible()
	await expect(page.getByRole('button', { name: 'QR-Code scannen' })).toBeHidden()
})
