import { expect, test } from '@playwright/test'
import { login, pinFonts } from './helpers'
import { MICROSOFT_APP_URL } from './servers'

// These tests only read the seeded data, so they may share the app instances.
// `fullyParallel` is off globally to keep them away from the functional tests,
// which write. See `playwright.config.ts`.
test.describe.configure({ mode: 'parallel' })

test('login page', async ({ page }) => {
	await page.goto('/')
	await expect(page.locator('.login-card')).toBeVisible()
	await pinFonts(page)

	await expect(page).toHaveScreenshot('login.png', { fullPage: true })
})

// Runs against the second app instance, whose backend has the provider
// configured, so `microsoft-login.css` is covered.
test.describe('microsoft provider', () => {
	test.use({ baseURL: MICROSOFT_APP_URL })

	test('login page', async ({ page }) => {
		await page.goto('/')
		await expect(page.locator('.microsoft-login-section')).toBeVisible()
		await expect(page.locator('.local-login-details')).toHaveCount(0)
		await expect(page.getByText('Lokales Konto verwenden')).toHaveCount(0)
		await pinFonts(page)

		await expect(page).toHaveScreenshot('login-microsoft.png', {
			fullPage: true,
		})
	})
})

test('overview', async ({ page }) => {
	await login(page)
	await expect(page.locator('.otp-list__item')).toHaveCount(3)
	await pinFonts(page)

	await expect(page).toHaveScreenshot('overview.png', {
		fullPage: true,
		mask: [
			// Countdown position depends on wall-clock time, not on the UI
			page.locator('.otp-list__timer-track'),
			// Holds the app version, which changes with every release
			page.locator('.app-footer'),
		],
	})
})

test('tags page', async ({ page }) => {
	await login(page)
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page).toHaveURL(/\/tags$/)
	await expect(page.locator('.tag-list__item')).toHaveCount(1)
	await pinFonts(page)

	await expect(page).toHaveScreenshot('tags.png', {
		fullPage: true,
		// Holds the app version, which changes with every release
		mask: [page.locator('.app-footer')],
	})
})

test('edit dialog', async ({ page }) => {
	await login(page)
	await page.getByRole('button', { name: 'Eintrag für test bearbeiten' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	await pinFonts(page)

	// Scoped to the dialog so unrelated changes behind the backdrop do not fail it
	await expect(dialog).toHaveScreenshot('edit-dialog.png')
})

test('qr scan dialog without scanner', async ({ page, hasTouch }) => {
	// The button that opens the dialog is only rendered on touch devices
	test.skip(!hasTouch, 'QR scan button exists on touch devices only')

	// Whether the platform can detect QR codes differs per host. Removing the API
	// pins the fallback, which is the state under test.
	await page.addInitScript(() => {
		Reflect.deleteProperty(globalThis, 'BarcodeDetector')
	})
	await login(page)
	await page.getByRole('button', { name: 'QR-Code scannen' }).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	await expect(
		dialog.getByText('QR-Scanner wird von diesem Browser nicht unterstützt.'),
	).toBeVisible()
	await pinFonts(page)

	await expect(dialog).toHaveScreenshot('qr-scan-dialog.png')
})
