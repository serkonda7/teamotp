import { SearchBar } from '@serkonda7/solid-components'
import { IconHome, IconLogout, IconTag } from '@tabler/icons-solidjs'
import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js'
import { navigate, path } from '../router'
import TeamOtpLogo from './TeamOtpLogo'
import ThemeToggle from './ThemeToggle'

type AppHeaderProps = {
	onLogout: () => void
	searchQuery: string
	onSearchInput: (query: string) => void
	tagSearchQuery: string
	onTagSearchInput: (query: string) => void
	/** Shown beside the children, in the space left of the action buttons */
	tagPills?: JSX.Element
	children?: JSX.Element
}

type HeaderSearchProps = {
	value: string
	onInput: (value: string) => void
	label: string
}

// SearchBar has no tabindex or select-on-focus option, so both are added here:
// the input stays first in the explicit tab order and selects its text on focus.
const HeaderSearch = (props: HeaderSearchProps): JSX.Element => {
	let wrapper: HTMLDivElement | undefined

	onMount(() => {
		const input = wrapper?.querySelector('input')
		if (input) {
			input.tabIndex = 1
		}
	})

	return (
		<div
			ref={wrapper}
			class="header-search-bar"
			onFocusIn={(event: FocusEvent): void => {
				if (event.target instanceof HTMLInputElement) {
					event.target.select()
				}
			}}
		>
			<SearchBar
				value={props.value}
				onInput={props.onInput}
				placeholder={props.label}
				ariaLabel={props.label}
				shortcutLabel="Strg K"
				clearLabel="Suche leeren"
			/>
		</div>
	)
}

const AppHeader = (props: AppHeaderProps): JSX.Element => {
	const [isScrolled, setIsScrolled] = createSignal(false)

	onMount(() => {
		const updateScrolled = (): void => {
			setIsScrolled(window.scrollY > 0)
		}

		updateScrolled()
		window.addEventListener('scroll', updateScrolled, { passive: true })

		onCleanup(() => {
			window.removeEventListener('scroll', updateScrolled)
		})
	})

	return (
		<header class="app-header" classList={{ 'app-header--scrolled': isScrolled() }}>
			<div class="app-title">
				<TeamOtpLogo class="app-title__logo" />
			</div>
			<div class="header-search">
				<Show
					when={path() === '/tags'}
					fallback={
						<HeaderSearch
							value={props.searchQuery}
							onInput={props.onSearchInput}
							label="Einträge suchen"
						/>
					}
				>
					<HeaderSearch
						value={props.tagSearchQuery}
						onInput={props.onTagSearchInput}
						label="Tags suchen"
					/>
				</Show>
				{props.children}
			</div>
			<div class="header-end">
				<div class="header-pills">{props.tagPills}</div>
				<div class="header-actions">
					<Show
						when={path() === '/tags'}
						fallback={
							<button
								type="button"
								class="icon-button"
								tabindex={5}
								onClick={(): void => navigate('/tags')}
								aria-label="Tags verwalten"
								title="Tags"
							>
								<IconTag size={18} stroke="2" aria-hidden="true" />
							</button>
						}
					>
						<button
							type="button"
							class="icon-button"
							tabindex={6}
							onClick={(): void => navigate('/')}
							aria-label="Zurück zur Übersicht"
							title="Übersicht"
						>
							<IconHome size={18} stroke="2" aria-hidden="true" />
						</button>
					</Show>
					<ThemeToggle tabindex={path() === '/tags' ? 7 : 6} />
					<button
						type="button"
						class="icon-button logout-button"
						tabindex={path() === '/tags' ? 8 : 7}
						onClick={props.onLogout}
						aria-label="Abmelden"
						title="Abmelden"
					>
						<IconLogout size={18} stroke="2" aria-hidden="true" />
					</button>
				</div>
			</div>
		</header>
	)
}

export default AppHeader
