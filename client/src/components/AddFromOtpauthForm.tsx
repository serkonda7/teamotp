import { IconPlus } from '@tabler/icons-solidjs'
import { useMutation } from '@tanstack/solid-query'
import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { create_entry } from '../api'
import { parse_otpauth_url } from '../otpauth_parse'
import { refresh_data } from '../queries'
import type { InputEventAndTarget } from '../types'
import QrScannerDialog from './QrScannerDialog'

type Props = {
	setError: (e: string | null) => void
	onCreated: (id: string) => void
}

const AddFromOtpauthForm = (props: Props): JSX.Element => {
	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const [scanning, setScanning] = createSignal(false)
	const createEntry = useMutation(() => ({ mutationFn: create_entry }))

	async function addFromOtpauthUrl(url: string): Promise<void> {
		props.setError(null)

		const raw = url.trim()
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

	function handleSubmit(e: SubmitEvent): void {
		e.preventDefault()
		void addFromOtpauthUrl(otpauthUrl())
	}

	function handleScan(raw: string): void {
		setScanning(false)
		void addFromOtpauthUrl(raw)
	}

	return (
		<>
			<form class="add-entry" onSubmit={handleSubmit}>
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

			<button
				type="button"
				class="add-entry-fab"
				tabindex={3}
				aria-label="QR-Code scannen"
				disabled={createEntry.isPending}
				onClick={() => {
					props.setError(null)
					setScanning(true)
				}}
			>
				<IconPlus size={28} stroke="2.5" aria-hidden="true" />
			</button>

			<Show when={scanning()}>
				<QrScannerDialog onScan={handleScan} onClose={() => setScanning(false)} />
			</Show>
		</>
	)
}

export default AddFromOtpauthForm
