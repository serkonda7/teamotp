import { expect, test } from '@playwright/test'
import { login, pinFonts, THEMES, useTheme } from './helpers'

for (const theme of THEMES) {
	test.describe(theme, () => {
		test('login page', async ({ page }) => {
			await useTheme(page, theme)
			await page.goto('/')
			await expect(page.locator('.login-card')).toBeVisible()
			await pinFonts(page)

			await expect(page).toHaveScreenshot(`login-${theme}.png`, { fullPage: true })
		})

		test('login page with microsoft provider', async ({ page }) => {
			// The provider is config driven and off in CI, so force it on to keep
			// `microsoft-login.css` covered in both themes.
			await page.route('**/api/auth/providers', async (route): Promise<void> => {
				await route.fulfill({ json: { local: true, microsoft: true } })
			})
			await useTheme(page, theme)
			await page.goto('/')
			await expect(page.locator('.microsoft-login-section')).toBeVisible()
			await pinFonts(page)

			await expect(page).toHaveScreenshot(`login-microsoft-${theme}.png`, { fullPage: true })
		})

		test('overview', async ({ page }) => {
			await useTheme(page, theme)
			await login(page)
			await expect(page.locator('.otp-list__item')).toHaveCount(3)
			await pinFonts(page)

			await expect(page).toHaveScreenshot(`overview-${theme}.png`, {
				fullPage: true,
				// Countdown position depends on wall-clock time, not on the UI
				mask: [page.locator('.otp-list__timer-track')],
			})
		})

		test('tags page', async ({ page }) => {
			await useTheme(page, theme)
			await login(page)
			await page.getByRole('button', { name: 'Tags verwalten' }).click()
			await expect(page).toHaveURL(/\/tags$/)
			await expect(page.locator('.tag-list__item')).toHaveCount(1)
			await pinFonts(page)

			await expect(page).toHaveScreenshot(`tags-${theme}.png`, { fullPage: true })
		})

		test('edit dialog', async ({ page }) => {
			await useTheme(page, theme)
			await login(page)
			await page.getByRole('button', { name: 'Eintrag für test bearbeiten' }).click()
			const dialog = page.locator('.modal-card')
			await expect(dialog).toBeVisible()
			await pinFonts(page)

			// Scoped to the dialog so unrelated changes behind the backdrop do not fail it
			await expect(dialog).toHaveScreenshot(`edit-dialog-${theme}.png`)
		})
	})
}
