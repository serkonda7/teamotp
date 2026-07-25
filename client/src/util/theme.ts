import { createSignal } from 'solid-js'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'teamotp-theme'

function getStoredTheme(): Theme | null {
	const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
	return stored === 'light' || stored === 'dark' ? stored : null
}

function getSystemTheme(): Theme {
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(value: Theme): void {
	document.documentElement.dataset.theme = value
}

const [theme, setTheme] = createSignal<Theme>(getStoredTheme() ?? getSystemTheme())

applyTheme(theme())

// Follow OS theme changes as long as the user has not chosen a theme explicitly
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
	if (getStoredTheme() === null) {
		const next: Theme = event.matches ? 'dark' : 'light'
		setTheme(next)
		applyTheme(next)
	}
})

export function toggleTheme(): void {
	const next: Theme = theme() === 'dark' ? 'light' : 'dark'
	window.localStorage.setItem(THEME_STORAGE_KEY, next)
	setTheme(next)
	applyTheme(next)
}

export { theme }
