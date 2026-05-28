import { IconLayoutGrid, IconList } from '@tabler/icons-solidjs'
import type { Component } from 'solid-js'

type AppHeaderProps = {
	onOpenAbout: () => void
	onLogout: () => void
	layoutMode: 'list' | 'grid'
	onLayoutModeChange: (mode: 'list' | 'grid') => void
}

const AppHeader: Component<AppHeaderProps> = (props) => (
	<header class="app-header">
		<div class="app-title">TeamOTP</div>
		<fieldset class="layout-toggle">
			<legend class="layout-toggle__legend">Layout</legend>
			<button
				type="button"
				class="layout-toggle__button"
				aria-label="Use grid layout"
				title="Grid layout"
				aria-pressed={props.layoutMode === 'grid'}
				onClick={() => props.onLayoutModeChange('grid')}
			>
				<IconLayoutGrid size={18} stroke="2" aria-hidden="true" />
			</button>
			<button
				type="button"
				class="layout-toggle__button"
				aria-label="Use list layout"
				title="List layout"
				aria-pressed={props.layoutMode === 'list'}
				onClick={() => props.onLayoutModeChange('list')}
			>
				<IconList size={18} stroke="2" aria-hidden="true" />
			</button>
		</fieldset>
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

export default AppHeader
