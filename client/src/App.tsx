import { client } from './api'
import type { OtpDisplayInfo } from '../../shared/src/types'
import { createResource, createSignal, For, Show } from 'solid-js'
import { parseOtpauthUrl } from './otpauth_url'
import type { NewOtpEntry } from '../../shared/src/types'

function App() {
	const [otps, { refetch }] = createResource(fetch_otps)
	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)

	async function fetch_otps(): Promise<OtpDisplayInfo[]> {
		const res = await client.otp.$get()
		const data = await res.json()
		return data as OtpDisplayInfo[]
	}

	async function addFromOtpauthUrl(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		setError(null)

		const raw = otpauthUrl().trim()
		if (!raw) {
			setError('Please paste an otpauth URL')
			return
		}

		let payload: NewOtpEntry
		try {
			payload = parseOtpauthUrl(raw)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to parse otpauth URL')
			return
		}

		setSubmitting(true)
		try {
			const res = await client.otp.$post({ json: payload })
			if (!res.ok) {
				const data = await res.json().catch(() => null)
				const msg = typeof data === 'object' && data && 'error' in data
					? String((data as { error: unknown }).error)
					: `Failed to add OTP entry (${res.status})`
				setError(msg)
				return
			}

			setOtpauthUrl('')
			await refetch()
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div>
			<h1>TeamOTP</h1>

			<form onSubmit={addFromOtpauthUrl}>
				<input
					type="text"
					placeholder="otpauth://totp/..."
					value={otpauthUrl()}
					onInput={(e) => setOtpauthUrl(e.currentTarget.value)}
					disabled={submitting()}
				/>
				<button type="submit" disabled={submitting()}>
					{submitting() ? 'Adding...' : 'Add from URL'}
				</button>
			</form>
			<Show when={error()}>
				<div>{error()}</div>
			</Show>

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
