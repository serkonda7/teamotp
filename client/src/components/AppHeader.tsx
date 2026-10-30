import { SearchBar } from '@serkonda7/solid-components'
import { IconLogout, IconTag } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js'
import TeamOtpLogo from './TeamOtpLogo'

type AppHeaderProps = {
	isTagsPage: boolean
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
	const navigate = useNavigate()
	const [isScrolled, setIsScrolled] = createSignal(false)
	let search: HTMLDivElement | undefined

	onMount(() => {
		// The header mounts once per session, so switching pages keeps the focus where it is
		search?.querySelector('input')?.focus()

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
			<div ref={search} class="header-search">
				<Show
					when={props.isTagsPage}
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
					<Show when={!props.isTagsPage}>
						<button
							type="button"
							class="icon-button header-button"
							tabindex={5}
							onClick={(): void => void navigate({ to: '/tags', search: true })}
							aria-label="Tags verwalten"
						>
							<IconTag size={18} stroke="2" aria-hidden="true" />
							Tags
						</button>
					</Show>
					<button
						type="button"
						class="icon-button header-button"
						tabindex={6}
						onClick={props.onLogout}
					>
						<IconLogout size={18} stroke="2" aria-hidden="true" />
						Abmelden
					</button>
				</div>
			</div>
		</header>
	)
}

export default AppHeader
