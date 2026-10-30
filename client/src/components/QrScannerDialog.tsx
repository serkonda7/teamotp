import { IconX } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { create_qr_decoder, open_camera, type QrDecoder } from '../util/qr_scan'

const SCAN_INTERVAL_MS = 200

type Props = {
	onScan: (raw: string) => void
	onClose: () => void
}

const QrScannerDialog = (props: Props): JSX.Element => {
	const [error, setError] = createSignal<string | null>(null)
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
			setError(decoder.error.message)
			return
		}

		const camera = await open_camera()
		if (Result.isError(camera)) {
			setError(camera.error.message)
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

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			props.onClose()
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeyDown)
		void start()
		onCleanup(() => {
			closed = true
			clearTimeout(timer)
			stopCamera()
			document.removeEventListener('keydown', handleKeyDown)
		})
	})

	return (
		<div class="modal-backdrop" role="presentation">
			<button
				type="button"
				class="modal-dismiss"
				aria-label="Dialog schließen"
				onClick={props.onClose}
			/>
			<div class="modal-card" role="dialog" aria-modal="true" aria-label="QR-Code scannen">
				<button
					type="button"
					class="icon-button modal-close"
					aria-label="Dialog schließen"
					onClick={props.onClose}
				>
					<IconX size={18} stroke="2" aria-hidden="true" />
				</button>

				<h2>QR-Code scannen</h2>

				<Show when={error()}>
					<div class="login-error">{error()}</div>
				</Show>

				<Show when={!error()}>
					<video ref={video} class="qr-scanner__video" autoplay muted playsinline />
				</Show>
			</div>
		</div>
	)
}

export default QrScannerDialog
