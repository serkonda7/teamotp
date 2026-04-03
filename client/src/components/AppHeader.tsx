type AppHeaderProps = {
	onOpenAbout: () => void
	onLogout: () => void
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
				<button type="button" class="info-button" onClick={props.onOpenAbout}>
					About
				</button>
				<button type="button" class="logout-button" onClick={props.onLogout}>
					Logout
				</button>
			</div>
		</header>
	)
}

export default AppHeader
