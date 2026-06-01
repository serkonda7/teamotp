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
	await page.getByText('Use local account').click()
	await page.getByLabel('Email').fill('e2e@test.com')
	await page.getByLabel('Password').fill('e2e-password')
	await page.getByRole('button', { name: 'Sign In' }).click()

	const copyButton = page.getByRole('button', { name: 'Copy OTP code for test' })
	await expect(copyButton).toBeVisible()

	await copyButton.click()
	await expect(page.getByRole('status')).toHaveText('Copied!')
	const firstCode = await page.evaluate(() => navigator.clipboard.readText())

	await page.waitForTimeout(5000)

	await copyButton.click()
	await expect(page.getByRole('status')).toHaveText('Copied!')
	const secondCode = await page.evaluate(() => navigator.clipboard.readText())

	expect(secondCode).not.toBe(firstCode)
})
