import { IconEye, IconEyeOff } from '@tabler/icons-solidjs'
import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { fetchOtpCode } from '../showAndCopyOtpCode'

type Props = {
	otp: OtpDisplayInfo
	setError: (e: string | null) => void
}

const OtpListItem: Component<Props> = (props) => {
	const [code, setCode] = createSignal<string | null>(null)
	const [isCodeVisible, setIsCodeVisible] = createSignal(false)
	const [isLoadingCode, setIsLoadingCode] = createSignal(false)

	const issuerSecond = props.otp.issuer_second.trim()
	const issuerText =
		issuerSecond.length > 0 && issuerSecond !== props.otp.issuer
			? `${props.otp.issuer} (${issuerSecond})`
			: props.otp.issuer

	async function toggleCodeVisibility() {
		if (isCodeVisible()) {
			setIsCodeVisible(false)
			return
		}

		if (code() !== null) {
			setIsCodeVisible(true)
			return
		}

		setIsLoadingCode(true)
		const fetchedCode = await fetchOtpCode(props.otp.id, props.setError)
		setIsLoadingCode(false)

		if (fetchedCode !== null) {
			setCode(fetchedCode)
			setIsCodeVisible(true)
		}
	}

	return (
		<li class="otp-list__item">
			<div class="otp-list__entry">
				<div class="otp-list__row">
					<div class="otp-list__content">
						<span class="otp-list__issuer">{issuerText}</span>
						<span
							class={`otp-list__secondary ${isCodeVisible() && code() !== null ? 'otp-list__secondary--code' : ''}`}
						>
							{isCodeVisible() && code() !== null ? code() : props.otp.label}
						</span>
					</div>
					<button
						type="button"
						class="otp-list__toggle"
						onClick={() => void toggleCodeVisibility()}
						aria-label={isCodeVisible() ? 'Hide OTP code' : 'Show OTP code'}
						title={isCodeVisible() ? 'Hide OTP code' : 'Show OTP code'}
						disabled={isLoadingCode()}
					>
						<Show when={isCodeVisible()} fallback={<IconEye size={18} />}>
							<IconEyeOff size={18} />
						</Show>
					</button>
				</div>
			</div>
		</li>
	)
}

export default OtpListItem
