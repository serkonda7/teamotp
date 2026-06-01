import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests/e2e',
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
		},
	],
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
