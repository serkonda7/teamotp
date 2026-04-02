type AppHeaderProps = {
	onOpenAbout: () => void
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
			<button type="button" class="info-button" onClick={props.onOpenAbout}>
				About
			</button>
		</header>
	)
}

export default AppHeader
