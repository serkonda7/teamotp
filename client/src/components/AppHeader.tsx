import { IconInfoCircle, IconLogout } from '@tabler/icons-solidjs'
import type { JSX } from 'solid-js'
import TeamOtpLogo from './TeamOtpLogo'

type AppHeaderProps = {
	onOpenAbout: () => void
	onLogout: () => void
}

const AppHeader = (props: AppHeaderProps): JSX.Element => (
	<header class="app-header">
		<div class="app-title">
			<TeamOtpLogo class="app-title__logo" />
		</div>
		<input
			disabled
			type="search"
			placeholder="Search coming soon"
			aria-label="Search OTP entries"
		/>
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
