import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component } from 'solid-js'
import { client } from '../api'
import { parseOtpauthUrl } from '../otpauth_url'

type Props = {
	otpauthUrl: () => string
	setOtpauthUrl: (v: string) => void
	submitting: () => boolean
	setSubmitting: (b: boolean) => void
	setError: (e: string | null) => void
	refetch: () => Promise<OtpDisplayInfo[]>
}

const AddFromOtpauthForm: Component<Props> = (props) => {
	async function addFromOtpauthUrl(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		props.setError(null)

		const raw = props.otpauthUrl().trim()
		if (!raw) {
			props.setError('Please paste an otpauth URL')
			return
		}

		const payload_res = parseOtpauthUrl(raw)
		if (payload_res.error) {
			props.setError(payload_res.error.message)
			return
		}

		props.setSubmitting(true)
		try {
			const res = await client.otp.$post({ json: payload_res.value })
			if (!res.ok) {
				const data = await res.json().catch(() => null)
				const msg =
					typeof data === 'object' && data && 'error' in data
						? String((data as { error: unknown }).error)
						: `Failed to add OTP entry (${res.status})`
				props.setError(msg)
				return
			}

			props.setOtpauthUrl('')
			await props.refetch()
		} finally {
			props.setSubmitting(false)
		}
	}

	return (
		<form onSubmit={addFromOtpauthUrl}>
			<input
				type="text"
				placeholder="otpauth://totp/..."
				value={props.otpauthUrl()}
				onInput={(e) => props.setOtpauthUrl(e.currentTarget.value)}
				disabled={props.submitting()}
			/>
			<button type="submit" disabled={props.submitting()}>
				{props.submitting() ? 'Adding...' : 'Add from URL'}
			</button>
		</form>
	)
}

export default AddFromOtpauthForm
