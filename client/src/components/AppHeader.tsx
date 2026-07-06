import { IconInfoCircle, IconLogout, IconSearch } from '@tabler/icons-solidjs'
import type { InputEventAndTarget } from 'shared/src/types'
import { createSignal, type JSX, onCleanup, onMount } from 'solid-js'
import TeamOtpLogo from './TeamOtpLogo'

type AppHeaderProps = {
	onOpenAbout: () => void
	onLogout: () => void
	searchQuery: string
	onSearchInput: (query: string) => void
}

const AppHeader = (props: AppHeaderProps): JSX.Element => {
	const [isScrolled, setIsScrolled] = createSignal(false)
	let searchInputRef: HTMLInputElement | undefined

	onMount(() => {
		const updateScrolled = (): void => {
			setIsScrolled(window.scrollY > 0)
		}

		updateScrolled()
		window.addEventListener('scroll', updateScrolled, { passive: true })

		const handleKeyDown = (event: KeyboardEvent): void => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()

				const activeElement = document.activeElement
				if (
					activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement
				) {
					return
				}

				searchInputRef?.focus()
			}
		}

		window.addEventListener('keydown', handleKeyDown)

		onCleanup(() => {
			window.removeEventListener('scroll', updateScrolled)
			window.removeEventListener('keydown', handleKeyDown)
		})
	})

	return (
		<header class="app-header" classList={{ 'app-header--scrolled': isScrolled() }}>
			<div class="app-title">
				<TeamOtpLogo class="app-title__logo" />
			</div>
			<div class="app-header__search-wrap">
				<IconSearch
					class="app-header__search-icon"
					size={16}
					stroke="2"
					aria-hidden="true"
				/>
				<input
					ref={searchInputRef}
					class="app-header__search"
					type="search"
					value={props.searchQuery}
					onInput={(event: InputEventAndTarget): void => {
						props.onSearchInput(event.currentTarget.value)
					}}
					placeholder="Suche"
					aria-label="OTP-Einträge suchen"
					autofocus
				/>
				<kbd
					class="app-header__search-shortcut"
					classList={{
						'app-header__search-shortcut--hidden': props.searchQuery.length > 0,
					}}
				>
					Strg K
				</kbd>
			</div>
			<div class="header-actions">
				<button
					type="button"
					class="icon-button info-button"
					onClick={props.onOpenAbout}
					aria-label="Über TeamOTP"
					title="Über"
				>
					<IconInfoCircle size={18} stroke="2" aria-hidden="true" />
				</button>
				<button type="button" class="logout-button" onClick={props.onLogout}>
					<IconLogout size={18} stroke="2" aria-hidden="true" />
					Abmelden
				</button>
			</div>
		</header>
	)
}

export default AppHeader
