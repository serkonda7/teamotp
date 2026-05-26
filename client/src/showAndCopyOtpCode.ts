import { client } from './api'

export async function showAndCopyOtpCode(
	id: string,
	setError: (e: string | null) => void,
): Promise<void> {
	setError(null)

	const res = await client.otp[':id'].$get({ param: { id } })
	if (!res.ok) {
		const data = await res.json().catch(() => null)
		const msg =
			typeof data === 'object' && data && 'error' in data
				? String((data as { error: unknown }).error)
				: `Failed to fetch OTP code (${res.status})`
		setError(msg)
		return
	}

	const data = (await res.json()) as { code: string }
	try {
		await navigator.clipboard.writeText(data.code)
	} catch {
		setError('Failed to copy OTP code to clipboard')
		return
	}

	alert(data.code)
}
