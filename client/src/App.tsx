import { client } from './api'
import type { OtpDisplayInfo } from '../../shared/src/types'
import { createResource, For, Show } from 'solid-js'

function App() {
	const [otps, { mutate, refetch }] = createResource(fetch_otps)

	async function fetch_otps(): Promise<OtpDisplayInfo[]> {
		const res = await client.otp.$get()
		const data = await res.json()
		return data as OtpDisplayInfo[]
	}

	return (
		<div>
			<h1>TeamOTP</h1>

			<Show
				when={!otps.loading}
				fallback={<div>Loading...</div>}
			>
				<ul>
					<For each={otps()}>
						{(otp) => (
							<li>{otp.issuer}: {otp.label}</li>
						)}
					</For>
				</ul>
			</Show>
		</div>
	)
}

export default App
