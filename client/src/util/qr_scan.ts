import { Result } from 'better-result'

/** Returns the content of the first QR code in the current frame, if there is one. */
export type QrDecoder = (video: HTMLVideoElement) => Promise<string | null>

const NATIVE_FORMAT = 'qr_code'
const UNSUPPORTED_MESSAGE = 'QR-Scanner wird von diesem Browser nicht unterstützt.'

/** BarcodeDetector is missing in Safari and Firefox. */
export async function create_qr_decoder(): Promise<Result<QrDecoder, Error>> {
	if (!('BarcodeDetector' in globalThis)) {
		return Result.err(new Error(UNSUPPORTED_MESSAGE))
	}

	// Chrome on Android exposes the API even if the platform can't detect QR codes
	const formats = await Result.tryPromise({
		try: () => BarcodeDetector.getSupportedFormats(),
		catch: () => new Error(UNSUPPORTED_MESSAGE),
	})
	if (Result.isError(formats)) {
		return Result.err(formats.error)
	}
	if (!formats.value.includes(NATIVE_FORMAT)) {
		return Result.err(new Error(UNSUPPORTED_MESSAGE))
	}

	const detector = new BarcodeDetector({ formats: [NATIVE_FORMAT] })
	return Result.ok(async (video: HTMLVideoElement) => {
		const codes = await detector.detect(video).catch(() => [])
		return codes[0]?.rawValue ?? null
	})
}

function camera_error(cause: unknown): Error {
	const name = cause instanceof DOMException ? cause.name : ''
	if (name === 'NotAllowedError') {
		return new Error('Kamerazugriff wurde verweigert.')
	}
	if (name === 'NotFoundError') {
		return new Error('Keine Kamera gefunden.')
	}
	return new Error('Kamera konnte nicht gestartet werden.')
}

export async function open_camera(): Promise<Result<MediaStream, Error>> {
	// Browsers only expose `mediaDevices` in secure contexts
	if (!navigator.mediaDevices) {
		return Result.err(new Error('Kamera ist nur über HTTPS verfügbar.'))
	}

	return Result.tryPromise({
		try: () =>
			navigator.mediaDevices.getUserMedia({
				audio: false,
				video: { facingMode: { ideal: 'environment' } },
			}),
		catch: camera_error,
	})
}
