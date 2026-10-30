import { IconPlus } from '@tabler/icons-solidjs'
import { useMutation } from '@tanstack/solid-query'
import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { create_entry } from '../api'
import { parse_otpauth_url } from '../otpauth_parse'
import { refresh_data } from '../queries'
import OtpauthUrlForm from './OtpauthUrlForm'
import QrScannerDialog from './QrScannerDialog'

type Props = {
	setError: (e: string | null) => void
	onCreated: (id: string) => void
}

const AddFromOtpauthForm = (props: Props): JSX.Element => {
	const [scanning, setScanning] = createSignal(false)
	const createEntry = useMutation(() => ({ mutationFn: create_entry }))

	async function addFromOtpauthUrl(url: string): Promise<Result<void, Error>> {
		const raw = url.trim()
		if (!raw) {
			return Result.err(new Error('Füge eine otpauth:// URL ein'))
		}

		const payload_res = parse_otpauth_url(raw)
		if (Result.isError(payload_res)) {
			return Result.err(payload_res.error)
		}

		const created = await createEntry.mutateAsync(Result.unwrap(payload_res))
		if (Result.isError(created)) {
			return Result.err(created.error)
		}

		await refresh_data()
		props.onCreated(created.value)
		return Result.ok(undefined)
	}

	async function handleScan(raw: string): Promise<void> {
		setScanning(false)

		const res = await addFromOtpauthUrl(raw)
		if (Result.isError(res)) {
			props.setError(res.error.message)
		}
	}

	async function handleDialogSubmit(url: string): Promise<Result<void, Error>> {
		const res = await addFromOtpauthUrl(url)
		if (Result.isOk(res)) {
			setScanning(false)
		}
		return res
	}

	return (
		<>
			<OtpauthUrlForm
				class="add-entry--page"
				pending={createEntry.isPending}
				setError={props.setError}
				onSubmit={addFromOtpauthUrl}
			/>

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
				<QrScannerDialog
					pending={createEntry.isPending}
					onScan={handleScan}
					onSubmit={handleDialogSubmit}
					onClose={() => setScanning(false)}
				/>
			</Show>
		</>
	)
}

export default AddFromOtpauthForm
