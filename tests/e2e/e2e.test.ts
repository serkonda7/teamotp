import { expect, test } from '@playwright/test'

test('login page loads', async ({ page }) => {
	await page.goto('/')

	await expect(page.locator('.login-card')).toBeVisible()
})

test('clicking the same entry again after 5 seconds copies a fresh code', async ({
	context,
	page,
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write'])

	await page.goto('/')
	const useLocalAccount = page.getByText('Lokales Konto verwenden')
	if ((await useLocalAccount.count()) > 0) {
		await useLocalAccount.click()
	}
	await page.getByLabel('E-Mail').fill('e2e@test.com')
	await page.getByLabel('Passwort').fill('e2e-password')
	await page.getByRole('button', { name: 'Anmelden' }).click()

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
