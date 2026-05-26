import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component, Resource } from 'solid-js'
import { For, Show } from 'solid-js'
import { client } from '../api'

type Props = {
	otps: Resource<OtpDisplayInfo[]>
	setError: (e: string | null) => void
	layoutMode?: 'list' | 'grid'
}

const OtpList: Component<Props> = (props) => {
	const layoutMode = () => props.layoutMode ?? 'list'

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
			<ul class={`otp-list otp-list--${layoutMode()}`}>
				<For each={props.otps()}>
					{(otp: OtpDisplayInfo) => {
						const issuerSecond = otp.issuer_second.trim()
						const issuerText =
							issuerSecond.length > 0 && issuerSecond !== otp.issuer
								? `${otp.issuer} (${issuerSecond})`
								: otp.issuer

						return (
							<li class="otp-list__item">
								<button
									type="button"
									class="otp-list__entry"
									onClick={() => void showAndCopyOtpCode(otp.id)}
								>
									<span class="otp-list__issuer">{issuerText}</span>
									<span class="otp-list__label">{otp.label}</span>
								</button>
							</li>
						)
					}}
				</For>
			</ul>
		</Show>
	)
}

export default OtpList
