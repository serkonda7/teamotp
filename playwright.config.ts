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
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
