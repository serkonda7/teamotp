import { Modal } from '@serkonda7/solid-components'
import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { create_qr_decoder, open_camera, type QrDecoder } from '../util/qr_scan'
import OtpauthUrlForm from './OtpauthUrlForm'

const SCAN_INTERVAL_MS = 200

type Props = {
	pending: boolean
	onScan: (raw: string) => void
	onSubmit: (url: string) => Promise<Result<void, Error>>
	onClose: () => void
}

const QrScannerDialog = (props: Props): JSX.Element => {
	const [scanError, setScanError] = createSignal<string | null>(null)
	const [formError, setFormError] = createSignal<string | null>(null)
	let video!: HTMLVideoElement
	let closed = false
	let stream: MediaStream | undefined
	let timer: ReturnType<typeof setTimeout> | undefined

	function stopCamera(): void {
		for (const track of stream?.getTracks() ?? []) {
			track.stop()
		}
	}

	async function scanFrame(decode: QrDecoder): Promise<void> {
		const raw = await decode(video)
		if (closed) {
			return
		}
		if (raw) {
			props.onScan(raw)
			return
		}
		timer = setTimeout(() => void scanFrame(decode), SCAN_INTERVAL_MS)
	}

	async function start(): Promise<void> {
		const decoder = await create_qr_decoder()
		if (Result.isError(decoder)) {
			setScanError(decoder.error.message)
			return
		}

		const camera = await open_camera()
		if (Result.isError(camera)) {
			setScanError(camera.error.message)
			return
		}

		stream = camera.value
		// The dialog may have been closed while waiting for the permission prompt
		if (closed) {
			stopCamera()
			return
		}

		video.srcObject = stream
		await scanFrame(decoder.value)
	}

	onMount(() => {
		void start()
		onCleanup(() => {
			closed = true
			clearTimeout(timer)
			stopCamera()
		})
	})

	return (
		<Modal open title="QR-Code scannen" closeLabel="Dialog schließen" onClose={props.onClose}>
			<Show when={formError() ?? scanError()}>
				<div class="login-error">{formError() ?? scanError()}</div>
			</Show>

			{/* Without a working scanner the URL is the only way to add an entry */}
			<Show
				when={scanError()}
				fallback={
					<video ref={video} class="qr-scanner__video" autoplay muted playsinline />
				}
			>
				<OtpauthUrlForm
					pending={props.pending}
					setError={setFormError}
					onSubmit={props.onSubmit}
				/>
			</Show>
		</Modal>
	)
}

export default QrScannerDialog
