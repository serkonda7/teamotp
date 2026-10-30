import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, type JSX, onCleanup, onMount, Show } from 'solid-js'
import { set_unauthorized_handler } from './api'
import { fetchMe, logout } from './api_auth'
import LoginPage from './components/login/LoginPage'
import MainView from './components/MainView'
import { query_client } from './queries'
import { start_idle_timer } from './util/idle_timeout'

function App(): JSX.Element {
	const navigate = useNavigate()
	const [isLoggedIn, setIsLoggedIn] = createSignal<boolean | null>(null)
	const [sessionExpired, setSessionExpired] = createSignal(false)

	onMount(async () => {
		setIsLoggedIn(await fetchMe())
	})

	async function handleLogout(): Promise<void> {
		await logout()
		clearSession()
	}

	/** Drops everything the logged in view holds, so nothing survives into the next session. */
	function clearSession(): void {
		// Before leaving the view, because the login page starts its own query on mount
		query_client.clear()
		setIsLoggedIn(false)
		void navigate({ to: '/', search: {} })
	}

	/** Returns to the login page with a notice, after a timeout or a logout elsewhere. */
	function handleSessionEnd(): void {
		if (!isLoggedIn()) {
			return
		}

		clearSession()
		setSessionExpired(true)
	}

	function handleLoginSuccess(): void {
		setSessionExpired(false)
		setIsLoggedIn(true)
	}

	// A 401 can answer any request once the server session timed out
	set_unauthorized_handler(handleSessionEnd)

	// Clear the view as soon as the session times out, without waiting for a request
	createEffect(() => {
		if (!isLoggedIn()) {
			return
		}

		const stop = start_idle_timer(() => {
			// Release the server session right away instead of leaving it to expire
			void logout()
			handleSessionEnd()
		})
		onCleanup(stop)
	})

	return (
		<Show when={isLoggedIn() !== null} fallback={<div>Laden...</div>}>
			<Show
				when={isLoggedIn()}
				fallback={
					<LoginPage
						sessionExpired={sessionExpired()}
						onLoginSuccess={handleLoginSuccess}
					/>
				}
			>
				<MainView onLogout={handleLogout} />
			</Show>
		</Show>
	)
}

export default App
