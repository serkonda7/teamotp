import type { OtpDisplayInfo } from 'shared/src/types'
import { createMemo, createResource, createSignal, type JSX, onMount, Show } from 'solid-js'
import { client } from './api'
import AboutDialog from './components/AboutDialog'
import AddFromOtpauthForm from './components/AddFromOtpauthForm'
import AppHeader from './components/AppHeader'
import LoginPage from './components/login/LoginPage'
import OtpList from './components/OtpList'
import { otpMatchesSearch } from './util/otp_search'
import { makeArrayRefetch } from './util/resource_helpers'

function App(): JSX.Element {
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
	const [aboutOpen, setAboutOpen] = createSignal(false)
	const [searchQuery, setSearchQuery] = createSignal('')

	const filteredOtps = createMemo<OtpDisplayInfo[]>(() => {
		const query = searchQuery()
		return otps().filter((otp) => otpMatchesSearch(otp, query))
	})

	onMount(async () => {
		try {
			const res = await fetch('/api/auth/me')
			setIsLoggedIn(res.ok)
		} catch {
			setIsLoggedIn(false)
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

	async function handleLogout(): Promise<void> {
		try {
			await fetch('/api/auth/logout', { method: 'POST' })
			setIsLoggedIn(false)
			setSearchQuery('')
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
					<AppHeader
						onOpenAbout={() => setAboutOpen(true)}
						onLogout={handleLogout}
						searchQuery={searchQuery()}
						onSearchInput={setSearchQuery}
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
						otps={filteredOtps()}
						loading={otps.loading}
						searchQuery={searchQuery()}
						setError={setError}
						refetch={refetchTyped}
					/>
				</div>
			</Show>
		</Show>
	)
}

export default App
