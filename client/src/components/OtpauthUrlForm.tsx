import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import type { InputEventAndTarget } from '../types'

type Props = {
	class?: string
	pending: boolean
	setError: (e: string | null) => void
	onSubmit: (url: string) => Promise<Result<void, Error>>
}

const OtpauthUrlForm = (props: Props): JSX.Element => {
	const [otpauthUrl, setOtpauthUrl] = createSignal('')

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		props.setError(null)

		const res = await props.onSubmit(otpauthUrl())
		if (Result.isError(res)) {
			props.setError(res.error.message)
			return
		}

		setOtpauthUrl('')
	}

	return (
		<form class={`add-entry ${props.class ?? ''}`} onSubmit={handleSubmit}>
			<input
				class="add-entry__input"
				type="text"
				tabindex={3}
				placeholder="otpauth://totp/..."
				aria-label="OTPAuth URL"
				value={otpauthUrl()}
				onInput={(e: InputEventAndTarget): void => {
					setOtpauthUrl(e.currentTarget.value)
					props.setError(null)
				}}
				disabled={props.pending}
				autocomplete="off"
				spellcheck={false}
			/>

			<button type="submit" class="add-entry__submit" tabindex={3} disabled={props.pending}>
				{props.pending ? 'Wird erstellt...' : 'Anlegen'}
			</button>
		</form>
	)
}

export default OtpauthUrlForm
