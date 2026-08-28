import { IconHome, IconInfoCircle, IconLogout, IconTag } from '@tabler/icons-solidjs'
import { createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js'
import { navigate, path } from '../router'
import SearchInput from './SearchInput'
import TeamOtpLogo from './TeamOtpLogo'
import ThemeToggle from './ThemeToggle'

type AppHeaderProps = {
	onOpenAbout: () => void
	onLogout: () => void
	searchQuery: string
	onSearchInput: (query: string) => void
	tagSearchQuery: string
	onTagSearchInput: (query: string) => void
	children?: JSX.Element
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
						<SearchInput
							value={props.searchQuery}
							onInput={props.onSearchInput}
							placeholder="Einträge suchen"
							ariaLabel="Einträge suchen"
						/>
					}
				>
					<SearchInput
						value={props.tagSearchQuery}
						onInput={props.onTagSearchInput}
						placeholder="Tags suchen"
						ariaLabel="Tags suchen"
					/>
				</Show>
				{props.children}
			</div>
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
					class="icon-button info-button"
					tabindex={path() === '/tags' ? 8 : 7}
					onClick={props.onOpenAbout}
					aria-label="Über TeamOTP"
					title="Über"
				>
					<IconInfoCircle size={18} stroke="2" aria-hidden="true" />
				</button>
				<button
					type="button"
					class="icon-button logout-button"
					tabindex={path() === '/tags' ? 9 : 8}
					onClick={props.onLogout}
					aria-label="Abmelden"
					title="Abmelden"
				>
					<IconLogout size={18} stroke="2" aria-hidden="true" />
				</button>
			</div>
		</header>
	)
}

export default AppHeader
