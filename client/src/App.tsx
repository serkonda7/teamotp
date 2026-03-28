import { createResource, createSignal, For, Show } from 'solid-js'
import type { NewOtpEntry, OtpDisplayInfo } from '../../shared/src/types'
import { client } from './api'
import { parseOtpauthUrl } from './otpauth_url'

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

		const payload_res = parseOtpauthUrl(raw)
		if (payload_res.error) {
			setError(payload_res.error.message)
			return
		}

		setSubmitting(true)
		try {
			const res = await client.otp.$post({ json: payload_res.value })
			if (!res.ok) {
				const data = await res.json().catch(() => null)
				const msg =
					typeof data === 'object' && data && 'error' in data
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

	async function showAndCopyOtpCode(id: string): Promise<void> {
		setError(null)

		const res = await client.otp[':id'].$get({ param: { id } })
		if (!res.ok) {
			const data = await res.json().catch(() => null)
			const msg =
				typeof data === 'object' && data && 'error' in data
					? String((data as { error: unknown }).error)
					: `Failed to fetch OTP code (${res.status})`
			setError(msg)
			return
		}

		const data = (await res.json()) as { code: string }
		try {
			await navigator.clipboard.writeText(data.code)
		} catch {
			setError('Failed to copy OTP code to clipboard')
			return
		}

		alert(data.code)
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

			<Show when={!otps.loading} fallback={<div>Loading...</div>}>
				<ul>
					<For each={otps()}>
						{(otp) => (
							<li>
								<button
									type="button"
									onClick={() => void showAndCopyOtpCode(otp.id)}
								>
									{otp.issuer}: {otp.label}
								</button>
							</li>
						)}
					</For>
				</ul>
			</Show>
		</div>
	)
}

export default App
