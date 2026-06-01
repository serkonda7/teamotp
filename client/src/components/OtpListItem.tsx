import { IconEye, IconEyeOff } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component } from 'solid-js'
import { createSignal, onCleanup, Show } from 'solid-js'
import { fetch_otp_code } from '../otp_list_item'

type Props = {
	otp: OtpDisplayInfo
	setError: (e: string | null) => void
}

const OtpListItem: Component<Props> = (props) => {
	const [code, setCode] = createSignal<string | null>(null)
	const [isCodeVisible, setIsCodeVisible] = createSignal(false)
	const [isLoadingCode, setIsLoadingCode] = createSignal(false)
	const [showCopyToast, setShowCopyToast] = createSignal(false)
	let copyToastTimer: ReturnType<typeof setTimeout> | undefined

	const issuerSecond = props.otp.issuer_second.trim()
	const issuerText =
		issuerSecond.length > 0 ? `${props.otp.issuer} (${issuerSecond})` : props.otp.issuer

	async function toggleCodeVisibility() {
		if (isCodeVisible()) {
			setIsCodeVisible(false)
			return
		}

		if (code() !== null) {
			setIsCodeVisible(true)
			return
		}

		props.setError(null)

		setIsLoadingCode(true)
		const code_res = await fetch_otp_code(props.otp.id)
		setIsLoadingCode(false)

		if (Result.isError(code_res)) {
			props.setError(code_res.error.message)
			return
		}

		setCode(code_res.value)
		setIsCodeVisible(true)
	}

	onCleanup(() => {
		if (copyToastTimer !== undefined) {
			clearTimeout(copyToastTimer)
		}
	})

	function triggerCopyToast() {
		setShowCopyToast(true)
		if (copyToastTimer !== undefined) {
			clearTimeout(copyToastTimer)
		}
		copyToastTimer = setTimeout(() => {
			setShowCopyToast(false)
		}, 1400)
	}

	async function copyCodeFromCard() {
		let value = code()

		if (value === null) {
			props.setError(null)
			const fetchedCodeResult = await fetch_otp_code(props.otp.id)
			if (Result.isError(fetchedCodeResult)) {
				props.setError(fetchedCodeResult.error.message)
				return
			}

			value = Result.unwrap(fetchedCodeResult)
			setCode(value)
		}

		try {
			await navigator.clipboard.writeText(value)
			triggerCopyToast()
		} catch {
			props.setError('Failed to copy OTP code to clipboard')
		}
	}

	return (
		<li class="otp-list__item">
			<button
				type="button"
				class="otp-list__copy"
				onClick={() => void copyCodeFromCard()}
				aria-label={`Copy OTP code for ${issuerText}`}
				title="Copy OTP code"
			/>
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
				onClick={(event) => {
					event.stopPropagation()
					void toggleCodeVisibility()
				}}
				aria-label={isCodeVisible() ? 'Hide OTP code' : 'Show OTP code'}
				title={isCodeVisible() ? 'Hide OTP code' : 'Show OTP code'}
				disabled={isLoadingCode()}
			>
				<Show when={isCodeVisible()} fallback={<IconEye size={18} />}>
					<IconEyeOff size={18} />
				</Show>
			</button>
			<Show when={showCopyToast()}>
				<div class="otp-list__copy-toast" role="status" aria-live="polite">
					Copied!
				</div>
			</Show>
		</li>
	)
}

export default OtpListItem
