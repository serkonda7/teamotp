import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

/** Inlined so screenshots never depend on the fonts installed on the host. */
const FONT_BASE64 = readFileSync(
	path.resolve(process.cwd(), 'tests', 'e2e', 'fonts', 'Inter-Variable-latin.woff2'),
).toString('base64')

export async function login(page: Page): Promise<void> {
	await page.goto('/')
	const useLocalAccount = page.getByText('Lokales Konto verwenden')
	if ((await useLocalAccount.count()) > 0) {
		await useLocalAccount.click()
	}
	await page.getByLabel('E-Mail').fill('e2e@test.com')
	await page.getByLabel('Passwort').fill('e2e-password')
	await page.getByRole('button', { name: 'Anmelden' }).click()
}

/**
 * Force a bundled font over every element.
 *
 * The app mixes three host-dependent stacks -- `system-ui` (`_base_theme.css`),
 * a `ui-monospace` stack for revealed codes (`otp-list.css`) and `"Segoe UI"`
 * for the Microsoft section (`microsoft-login.css`). Each resolves differently
 * per machine, which would make baselines valid only where they were generated.
 *
 * Must be called after navigation, and again after any full page reload.
 */
export async function pinFonts(page: Page): Promise<void> {
	await page.addStyleTag({
		content: `
			@font-face {
				font-family: 'VisualTest';
				src: url(data:font/woff2;base64,${FONT_BASE64}) format('woff2');
				font-weight: 100 900;
				font-style: normal;
				font-display: block;
			}
			* { font-family: 'VisualTest' !important; }
		`,
	})
	await page.evaluate(async (): Promise<void> => {
		await Promise.all([
			document.fonts.load('400 16px VisualTest'),
			document.fonts.load('700 16px VisualTest'),
		])
		await document.fonts.ready
	})
}
