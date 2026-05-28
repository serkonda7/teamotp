import { resolve } from 'node:path'
import devtools from 'solid-devtools/vite'
import { defineConfig } from 'vite'
import entryShakingPlugin from 'vite-plugin-entry-shaking'
import solidPlugin from 'vite-plugin-solid'

const tablerIconsEntry = resolve(
	import.meta.dirname,
	'node_modules/@tabler/icons-solidjs/dist/source/icons/index.js',
)

export default defineConfig({
	plugins: [
		entryShakingPlugin({
			targets: [tablerIconsEntry],
		}),
		devtools(),
		solidPlugin(),
	],
	resolve: {
		alias: {
			'@tabler/icons-solidjs': tablerIconsEntry,
		},
	},
	server: {
		port: 5371,
		proxy: {
			'/api': {
				target: 'http://localhost:3000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, ''),
			},
		},
	},
	build: {
		target: 'esnext',
	},
})
