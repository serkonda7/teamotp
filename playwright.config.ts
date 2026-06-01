import { defineConfig, devices } from '@playwright/test'
import { E2E_DB_PATH } from './tests/e2e/global-setup'

export default defineConfig({
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['html', { open: 'never' }], ['list']],
	use: {
		baseURL: 'http://localhost:5371',
		trace: 'on-first-retry',
	},
	webServer: [
		{
			command: 'bun run dev',
			url: 'http://localhost:5371',
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
			env: {
				...process.env,
				TEAMOTP_DB_PATH: E2E_DB_PATH,
			},
		},
	],
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
