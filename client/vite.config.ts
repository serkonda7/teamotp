import { readFileSync } from 'node:fs'
import { tablerIcons } from '@serkonda7/solid-components/vite'
import devtools from 'solid-devtools/vite'
import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const APP_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
	.version as string

const CLIENT_PORT = Number(process.env.TEAMOTP_CLIENT_PORT ?? 5372)

export default defineConfig({
	plugins: [tablerIcons(), devtools(), solidPlugin()],
	define: {
		__APP_VERSION__: JSON.stringify(APP_VERSION),
	},
	// A second dev server runs next to the default one during the e2e tests, so
	// port, API target and dep cache have to be overridable.
	cacheDir: `node_modules/.vite-${CLIENT_PORT}`,
	server: {
		port: CLIENT_PORT,
		proxy: {
			'/api': {
				target: process.env.TEAMOTP_API_URL ?? 'http://localhost:3001',
				changeOrigin: true,
				rewrite: (path: string) => path.replace(/^\/api/, ''),
			},
		},
	},
	build: {
		target: 'esnext',
	},
})
