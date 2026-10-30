import { useMutation } from '@tanstack/solid-query'
import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal } from 'solid-js'
import { create_entry } from '../api'
import { parse_otpauth_url } from '../otpauth_parse'
import { refresh_data } from '../queries'
import type { InputEventAndTarget } from '../types'

type Props = {
	setError: (e: string | null) => void
	onCreated: (id: string) => void
}

const AddFromOtpauthForm = (props: Props): JSX.Element => {
	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const createEntry = useMutation(() => ({ mutationFn: create_entry }))

	async function addFromOtpauthUrl(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		props.setError(null)

		const raw = otpauthUrl().trim()
		if (!raw) {
			props.setError('Füge eine otpauth:// URL ein')
			return
		}

		const payload_res = parse_otpauth_url(raw)
		if (Result.isError(payload_res)) {
			props.setError(payload_res.error.message)
			return
		}

		const created = await createEntry.mutateAsync(Result.unwrap(payload_res))
		if (Result.isError(created)) {
			props.setError(created.error.message)
			return
		}

		setOtpauthUrl('')
		await refresh_data()
		props.onCreated(created.value)
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
				value={otpauthUrl()}
				onInput={(e: InputEventAndTarget): void => {
					setOtpauthUrl(e.currentTarget.value)
					props.setError(null)
				}}
				disabled={createEntry.isPending}
				autocomplete="off"
				spellcheck={false}
			/>

			<button
				type="submit"
				class="add-entry__submit"
				tabindex={3}
				disabled={createEntry.isPending}
			>
				{createEntry.isPending ? 'Wird erstellt...' : 'Neuer Eintrag'}
			</button>
		</form>
	)
}

export default AddFromOtpauthForm
