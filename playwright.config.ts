import { defineConfig, devices } from '@playwright/test'
import {
	API_URL,
	APP_URL,
	CONFIG_PATH,
	E2E_DB_PATH,
	MICROSOFT_API_PORT,
	MICROSOFT_API_URL,
	MICROSOFT_APP_PORT,
	MICROSOFT_APP_URL,
	MICROSOFT_CONFIG_PATH,
	MICROSOFT_E2E_DB_PATH,
} from './tests/e2e/servers'

export default defineConfig({
	testDir: './tests/e2e',
	globalSetup: './tests/e2e/global-setup.ts',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['html', { open: 'never' }], ['list']],
	use: {
		baseURL: APP_URL,
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
	// Two app instances, one per server config: the default one and a second one
	// whose backend has Microsoft auth configured. See `tests/e2e/servers.ts`.
	webServer: [
		{
			command: 'bun run --cwd server dev',
			url: `${API_URL}/auth/providers`,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				...process.env,
				TEAMOTP_CONFIG_PATH: CONFIG_PATH,
				TEAMOTP_DB_PATH: E2E_DB_PATH,
			},
		},
		{
			command: 'bun run --cwd client dev',
			url: APP_URL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				...process.env,
				TEAMOTP_API_URL: API_URL,
			},
		},
		{
			command: 'bun run --cwd server dev',
			url: `${MICROSOFT_API_URL}/auth/providers`,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				...process.env,
				TEAMOTP_CONFIG_PATH: MICROSOFT_CONFIG_PATH,
				TEAMOTP_DB_PATH: MICROSOFT_E2E_DB_PATH,
				TEAMOTP_PORT: String(MICROSOFT_API_PORT),
			},
		},
		{
			command: 'bun run --cwd client dev',
			url: MICROSOFT_APP_URL,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				...process.env,
				TEAMOTP_API_URL: MICROSOFT_API_URL,
				TEAMOTP_CLIENT_PORT: String(MICROSOFT_APP_PORT),
			},
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
