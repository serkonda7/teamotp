import { IconMoon, IconSun } from '@tabler/icons-solidjs'
import type { JSX } from 'solid-js'
import { theme, toggleTheme } from '../util/theme'

type ThemeToggleProps = {
	tabindex: number
}

const ThemeToggle = (props: ThemeToggleProps): JSX.Element => {
	const label = (): string =>
		theme() === 'dark' ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'

	return (
		<button
			type="button"
			class="icon-button theme-toggle"
			tabindex={props.tabindex}
			onClick={toggleTheme}
			aria-label={label()}
			title={label()}
		>
			{theme() === 'dark' ? (
				<IconSun size={18} stroke="2" aria-hidden="true" />
			) : (
				<IconMoon size={18} stroke="2" aria-hidden="true" />
			)}
		</button>
	)
}

export default ThemeToggle
