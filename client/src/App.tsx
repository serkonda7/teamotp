import type { OtpDisplayInfo } from 'shared/src/types'
import { createResource, createSignal, Show } from 'solid-js'
import { client } from './api'
import AddFromOtpauthForm from './components/AddFromOtpauthForm'
import OtpList from './components/OtpList'
import { makeArrayRefetch } from './util/resource_helpers'

function App() {
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

	return (
		<div>
			<header class="app-header">
				<div class="app-title">TeamOTP</div>
				<input disabled type="search" placeholder="Search coming soon" aria-label="Search OTP entries" />
				<button type="button" class="info-button" onClick={() => setAboutOpen(true)}>
					About
				</button>
			</header>

			<Show when={aboutOpen()}>
				<div class="modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
					<div class="modal-card" role="dialog" aria-modal="true" aria-label="About TeamOTP" onClick={(e) => e.stopPropagation()}>
						<h2>About TeamOTP</h2>
						<p>Version 0.0.1</p>
						<a href="https://github.com/serkonda7/teamotp" target="_blank" rel="noreferrer">
							github.com/serkonda7/teamotp
						</a>
						<div class="modal-actions">
							<button type="button" onClick={() => setAboutOpen(false)}>
								Close
							</button>
						</div>
					</div>
				</div>
			</Show>

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
	)
}

export default App
