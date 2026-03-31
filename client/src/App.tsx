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

	async function fetch_otps(): Promise<OtpDisplayInfo[]> {
		const res = await client.otp.$get()
		const data = await res.json()
		return data as OtpDisplayInfo[]
	}

	return (
		<div>
			<h1>TeamOTP</h1>

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
