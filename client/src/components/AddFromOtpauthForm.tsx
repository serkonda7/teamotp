import { Result } from 'better-result'
import type { InputEventAndTarget, OtpDisplayInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
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

const AddFromOtpauthForm = (props: Props): JSX.Element => {
	async function addFromOtpauthUrl(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		props.setError(null)

		const raw = props.otpauthUrl().trim()
		if (!raw) {
			props.setError('Füge eine otpauth:// URL ein')
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
				const msg = await read_api_error(
					res,
					`Fehler beim Hinzufügen des Eintrags (${res.status})`,
				)
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
		<form class="add-entry" onSubmit={addFromOtpauthUrl}>
			<input
				id="otpauth-url"
				class="add-entry__input"
				type="text"
				tabindex={3}
				placeholder="otpauth://totp/..."
				aria-label="OTPAuth URL"
				value={props.otpauthUrl()}
				onInput={(e: InputEventAndTarget): void => {
					props.setOtpauthUrl(e.currentTarget.value)
					props.setError(null)
				}}
				disabled={props.submitting()}
				autocomplete="off"
				spellcheck={false}
			/>

			<button
				type="submit"
				class="add-entry__submit"
				tabindex={3}
				disabled={props.submitting()}
			>
				{props.submitting() ? 'Wird erstellt...' : 'Neuer Eintrag'}
			</button>
		</form>
	)
}

export default AddFromOtpauthForm
