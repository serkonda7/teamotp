import { Show } from 'solid-js'

type AppHeaderProps = {
	onOpenAbout: () => void
	user?: { name: string; email: string } | null
	onLogout?: () => void
}

function AppHeader(props: AppHeaderProps) {
	return (
		<header class="app-header">
			<div class="app-title">TeamOTP</div>
			<input
				disabled
				type="search"
				placeholder="Search coming soon"
				aria-label="Search OTP entries"
			/>
			<div class="header-actions">
				<Show when={props.user}>
					<span class="header-user">{props.user?.name}</span>
					<button type="button" class="logout-button" onClick={props.onLogout}>
						Sign out
					</button>
				</Show>
				<button type="button" class="info-button" onClick={props.onOpenAbout}>
					About
				</button>
			</div>
		</header>
	)
}

export default AppHeader
