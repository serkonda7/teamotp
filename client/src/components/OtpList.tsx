import type { Component, Resource } from 'solid-js'
import { For, Show } from 'solid-js'
import type { OtpDisplayInfo } from '../../../shared/src/types'
import { client } from '../api'

type Props = {
	otps: Resource<OtpDisplayInfo[]>
	setError: (e: string | null) => void
}

const OtpList: Component<Props> = (props) => {
	async function showAndCopyOtpCode(id: string): Promise<void> {
		props.setError(null)

		const res = await client.otp[':id'].$get({ param: { id } })
		if (!res.ok) {
			const data = await res.json().catch(() => null)
			const msg =
				typeof data === 'object' && data && 'error' in data
					? String((data as { error: unknown }).error)
					: `Failed to fetch OTP code (${res.status})`
			props.setError(msg)
			return
		}

		const data = (await res.json()) as { code: string }
		try {
			await navigator.clipboard.writeText(data.code)
		} catch {
			props.setError('Failed to copy OTP code to clipboard')
			return
		}

		alert(data.code)
	}

	return (
		<Show when={!props.otps.loading} fallback={<div>Loading...</div>}>
			<ul>
				<For each={props.otps()}>
					{(otp: OtpDisplayInfo) => (
						<li>
							<button type="button" onClick={() => void showAndCopyOtpCode(otp.id)}>
								{otp.issuer}: {otp.label}
							</button>
						</li>
					)}
				</For>
			</ul>
		</Show>
	)
}

export default OtpList
