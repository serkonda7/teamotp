import type { OtpDisplayInfo } from 'shared/src/types'
import { createResource, createSignal, Match, Show, Switch } from 'solid-js'
import { client } from './api'
import AboutDialog from './components/AboutDialog'
import AddFromOtpauthForm from './components/AddFromOtpauthForm'
import AppHeader from './components/AppHeader'
import OtpList from './components/OtpList'
import { makeArrayRefetch } from './util/resource_helpers'

interface AuthState {
	authenticated: boolean
	user?: { oid: string; email: string; name: string } | null
}

async function fetchAuthState(): Promise<AuthState> {
	const res = await fetch('/api/auth/me')
	if (res.status === 401) {
		return { authenticated: false }
	}
	if (!res.ok) {
		throw new Error('Failed to check authentication status')
	}
	return res.json()
}

function App() {
	const [authState] = createResource<AuthState>(fetchAuthState)

	const [otps, { refetch }] = createResource<OtpDisplayInfo[]>(fetch_otps, { initialValue: [] })
	const refetchTyped = makeArrayRefetch<OtpDisplayInfo>(refetch)

	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)
	const [aboutOpen, setAboutOpen] = createSignal(false)

	async function fetch_otps(): Promise<OtpDisplayInfo[]> {
		const res = await client.otp.$get()
		const data = await res.json()
		return data as OtpDisplayInfo[]
	}

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' })
		window.location.reload()
	}

	return (
		<Switch>
			<Match when={authState.loading}>
				<div class="auth-loading">Loading...</div>
			</Match>
			<Match when={!authState()?.authenticated}>
				<div class="login-page">
					<h1 class="login-title">TeamOTP</h1>
					<a href="/api/auth/login" class="login-button">
						Sign in with Microsoft
					</a>
				</div>
			</Match>
			<Match when={authState()?.authenticated}>
				<div>
					<AppHeader
						onOpenAbout={() => setAboutOpen(true)}
						user={authState()?.user}
						onLogout={logout}
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

					<OtpList otps={otps} setError={setError} />
				</div>
			</Match>
		</Switch>
	)
}

export default App
