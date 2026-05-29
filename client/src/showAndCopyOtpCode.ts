import { client } from './api'
import { readApiErrorMessage } from './util/api_error'

export async function fetchOtpCode(
	id: string,
	setError: (e: string | null) => void,
): Promise<string | null> {
	setError(null)

	const res = await client.otp[':id'].$get({ param: { id } })
	if (!res.ok) {
		const msg = await readApiErrorMessage(res, `Failed to fetch OTP code (${res.status})`)
		setError(msg)
		return null
	}

	const data = (await res.json()) as { code: string }
	return data.code
}

export async function showAndCopyOtpCode(
	id: string,
	setError: (e: string | null) => void,
): Promise<void> {
	const code = await fetchOtpCode(id, setError)
	if (code === null) {
		return
	}

	try {
		await navigator.clipboard.writeText(code)
	} catch {
		setError('Failed to copy OTP code to clipboard')
		return
	}

	alert(code)
}
