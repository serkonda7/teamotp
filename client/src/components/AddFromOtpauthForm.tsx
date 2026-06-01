import { Result } from 'better-result'
import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component } from 'solid-js'
import { client } from '../api'
import { parse_otpauth_url } from '../otpauth_parse'
import { read_api_error } from '../util/api_error'

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

		const payload_res = parse_otpauth_url(raw)
		if (Result.isError(payload_res)) {
			props.setError(payload_res.error.message)
			return
		}

		props.setSubmitting(true)
		try {
			const res = await client.otp.$post({ json: Result.unwrap(payload_res) })
			if (!res.ok) {
				const msg = await read_api_error(res, `Failed to add OTP entry (${res.status})`)
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
