import type { OtpDisplayInfo } from 'shared/src/types'
import { createResource, createSignal, onCleanup, onMount, Show } from 'solid-js'
import { client } from './api'
import AboutDialog from './components/AboutDialog'
import AddFromOtpauthForm from './components/AddFromOtpauthForm'
import AppHeader from './components/AppHeader'
import LoginPage from './components/login/LoginPage'
import OtpList from './components/OtpList'
import { type OtpLayoutMode, persistLayoutMode, readStoredLayoutMode } from './layout_mode'
import { makeArrayRefetch } from './util/resource_helpers'

function App() {
	const [isLoggedIn, setIsLoggedIn] = createSignal<boolean | null>(null)

	const [otps, { refetch }] = createResource(
		isLoggedIn,
		async (loggedIn) => {
			if (!loggedIn) {
				return []
			}
			return await fetchOtps()
		},
		{ initialValue: [] },
	)
	const refetchTyped = makeArrayRefetch<OtpDisplayInfo>(refetch)

	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)
	const [toast, setToast] = createSignal<string | null>(null)
	const [aboutOpen, setAboutOpen] = createSignal(false)
	const [otpLayoutMode, setOtpLayoutMode] = createSignal<OtpLayoutMode>(readStoredLayoutMode())
	let toastTimer: ReturnType<typeof setTimeout> | undefined

	onMount(async () => {
		try {
			const res = await fetch('/api/auth/me')
			setIsLoggedIn(res.ok)
		} catch {
			setIsLoggedIn(false)
		}
	})

	onCleanup(() => {
		if (toastTimer !== undefined) {
			clearTimeout(toastTimer)
		}
	})

	async function fetchOtps(): Promise<OtpDisplayInfo[]> {
		const res = await client.otp.$get()
		if (res.status === 401) {
			setIsLoggedIn(false)
			return []
		}
		const data = await res.json()
		return data as OtpDisplayInfo[]
	}

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' })
			setIsLoggedIn(false)
		} catch (err) {
			console.error('Logout failed', err)
		}
	}

	function handleLayoutModeChange(mode: OtpLayoutMode) {
		setOtpLayoutMode(mode)
		persistLayoutMode(mode)
	}

	function showToast(message: string) {
		setToast(message)
		if (toastTimer !== undefined) {
			clearTimeout(toastTimer)
		}
		toastTimer = setTimeout(() => {
			setToast(null)
		}, 1800)
	}

	return (
		<Show when={isLoggedIn() !== null} fallback={<div>Loading...</div>}>
			<Show
				when={isLoggedIn()}
				fallback={<LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />}
			>
				<div>
					<AppHeader
						onOpenAbout={() => setAboutOpen(true)}
						onLogout={handleLogout}
						layoutMode={otpLayoutMode()}
						onLayoutModeChange={handleLayoutModeChange}
					/>
					<AboutDialog open={aboutOpen()} onClose={() => setAboutOpen(false)} />

					<AddFromOtpauthForm
						otpauthUrl={otpauthUrl}
						setOtpauthUrl={setOtpauthUrl}
						submitting={submitting}
						setSubmitting={setSubmitting}
						setError={setError}
						refetch={refetchTyped}
					/>

					<Show when={error()}>
						<div>{error()}</div>
					</Show>

					<OtpList
						otps={otps}
						setError={setError}
						setToast={showToast}
						layoutMode={otpLayoutMode()}
					/>

					<Show when={toast()}>
						<div class="toast" role="status" aria-live="polite">
							{toast()}
						</div>
					</Show>
				</div>
			</Show>
		</Show>
	)
}

export default App
