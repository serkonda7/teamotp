import { defineConfig, devices } from '@playwright/test'
import { E2E_DB_PATH } from './tests/e2e/global-setup'

export default defineConfig({
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['html', { open: 'never' }], ['list']],
	use: {
		baseURL: 'http://localhost:5371',
		trace: 'on-first-retry',
	},
	expect: {
		toHaveScreenshot: {
			// Absorbs antialiasing noise between hosts; real regressions are far larger
			maxDiffPixelRatio: 0.01,
			animations: 'disabled',
			caret: 'hide',
			scale: 'css',
		},
	},
	// No `{platform}` segment: fonts are pinned in the tests, so one baseline set
	// is meant to be valid on every host.
	snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
	webServer: [
		{
			command: 'bun run --cwd server dev',
			url: 'http://localhost:3000/auth/providers',
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				...process.env,
				TEAMOTP_DB_PATH: E2E_DB_PATH,
			},
		},
		{
			command: 'bun run --cwd client dev',
			url: 'http://localhost:5371',
			reuseExistingServer: false,
			timeout: 120_000,
		},
	],
	projects: [
		{
			name: 'chromium',
			testIgnore: /.*\.visual\.test\.ts/,
			use: { ...devices['Desktop Chrome'] },
		},
		// Viewports are set explicitly rather than via device descriptors, whose
		// `isMobile`/`deviceScaleFactor` values change between Playwright releases
		// and would silently invalidate every baseline on upgrade.
		{
			name: 'visual-desktop',
			testMatch: /.*\.visual\.test\.ts/,
			use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
		},
		{
			// Below the 800px header and 860px add-entry breakpoints
			name: 'visual-narrow',
			testMatch: /.*\.visual\.test\.ts/,
			use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
		},
	],
})
