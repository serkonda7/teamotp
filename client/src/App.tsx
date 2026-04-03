import type { OtpDisplayInfo } from 'shared/src/types'
import { createResource, createSignal, onMount, Show } from 'solid-js'
import { client } from './api'
import AboutDialog from './components/AboutDialog'
import AddFromOtpauthForm from './components/AddFromOtpauthForm'
import AppHeader from './components/AppHeader'
import LoginPage from './components/LoginPage'
import OtpList from './components/OtpList'
import { makeArrayRefetch } from './util/resource_helpers'

function App() {
	const [isLoggedIn, setIsLoggedIn] = createSignal<boolean | null>(null)

	const [otps, { refetch }] = createResource(isLoggedIn, async (loggedIn) => {
		if (!loggedIn) {
			return []
		}
		return await fetch_otps()
	}, { initialValue: [] })
	const refetchTyped = makeArrayRefetch<OtpDisplayInfo>(refetch)

	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)
	const [aboutOpen, setAboutOpen] = createSignal(false)

	onMount(async () => {
		try {
			const res = await fetch('/api/auth/me')
			setIsLoggedIn(res.ok)
		} catch {
			setIsLoggedIn(false)
		}
	})

	async function fetch_otps(): Promise<OtpDisplayInfo[]> {
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

	return (
		<Show when={isLoggedIn() !== null} fallback={<div>Loading...</div>}>
			<Show
				when={isLoggedIn()}
				fallback={<LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />}
			>
				<div>
					<AppHeader onOpenAbout={() => setAboutOpen(true)} onLogout={handleLogout} />
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

					<OtpList otps={otps} setError={setError} />
				</div>
			</Show>
		</Show>
	)
}

export default App
