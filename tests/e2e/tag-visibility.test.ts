import { expect, test } from '@playwright/test'
import { login } from './helpers'

test('entry tags can be hidden without changing tag filters', async ({ page }) => {
	await login(page)

	const entry = page.locator('.otp-list__item', { hasText: 'GitHub' })
	const filterButton = page.getByRole('button', { name: 'Nach Tags filtern' })
	await expect(entry.locator('.otp-list__tags .tag-chip')).toHaveText('Server')

	await filterButton.click()
	await page.getByRole('button', { name: 'Tags in Übersicht ausblenden' }).click()
	await expect(entry.locator('.otp-list__tags')).toHaveCount(0)

	const serverFilter = page.locator('.tag-filter__chip', { hasText: 'Server' })
	await serverFilter.click()
	await expect(serverFilter).toHaveAttribute('aria-pressed', 'true')
	await expect(filterButton.locator('.tag-filter__badge')).toHaveText('1')
	await expect(page.locator('.otp-list__item')).toHaveCount(1)
	await expect(entry).toBeVisible()
	await expect(page.getByRole('list', { name: 'Aktive Tag-Filter' })).toBeVisible()

	// The visibility choice is retained across pages, but does not hide tags there.
	await page.getByRole('button', { name: 'Tags verwalten' }).click()
	await expect(page.locator('.tag-list__item .tag-chip', { hasText: 'Server' })).toBeVisible()
	await page.getByRole('link', { name: 'Übersicht' }).click()
	await expect(entry.locator('.otp-list__tags')).toHaveCount(0)
	await filterButton.click()
	await page.getByRole('button', { name: 'Tags in Übersicht anzeigen' }).click()
	await expect(entry.locator('.otp-list__tags .tag-chip')).toHaveText('Server')
	await expect(serverFilter).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.otp-list__item')).toHaveCount(1)
})
