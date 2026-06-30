import { IconInfoCircle, IconLogout, IconSearch } from '@tabler/icons-solidjs'
import type { InputEventAndTarget } from 'shared/src/types'
import type { JSX } from 'solid-js'
import TeamOtpLogo from './TeamOtpLogo'

type AppHeaderProps = {
	onOpenAbout: () => void
	onLogout: () => void
	searchQuery: string
	onSearchInput: (query: string) => void
}

const AppHeader = (props: AppHeaderProps): JSX.Element => (
	<header class="app-header">
		<div class="app-title">
			<TeamOtpLogo class="app-title__logo" />
		</div>
		<div class="app-header__search-wrap">
			<IconSearch class="app-header__search-icon" size={16} stroke="2" aria-hidden="true" />
			<input
				class="app-header__search"
				type="search"
				value={props.searchQuery}
				onInput={(event: InputEventAndTarget): void => {
					props.onSearchInput(event.currentTarget.value)
				}}
				placeholder="Search"
				aria-label="Search OTP entries"
				autofocus
			/>
		</div>
		<div class="header-actions">
			<button
				type="button"
				class="icon-button info-button"
				onClick={props.onOpenAbout}
				aria-label="About TeamOTP"
				title="About"
			>
				<IconInfoCircle size={18} stroke="2" aria-hidden="true" />
			</button>
			<button type="button" class="logout-button" onClick={props.onLogout}>
				<IconLogout size={18} stroke="2" aria-hidden="true" />
				Sign out
			</button>
		</div>
	</header>
)

export default AppHeader
