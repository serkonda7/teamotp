import { IconEye, IconEyeOff } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component } from 'solid-js'
import { createEffect, createMemo, createSignal, onCleanup, Show } from 'solid-js'
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
	const [nowEpochMs, setNowEpochMs] = createSignal(Date.now())
	const [lastPeriodCounter, setLastPeriodCounter] = createSignal<number | null>(null)
	let copyToastTimer: ReturnType<typeof setTimeout> | undefined
	let tickTimer: ReturnType<typeof setInterval> | undefined
	let isAutoRefreshingCode = false

	const periodSeconds = Math.max(1, props.otp.period)

	const periodCounter = createMemo(() => Math.floor(nowEpochMs() / 1000 / periodSeconds))

	const remainingRatio = createMemo(() => {
		const elapsedInPeriod = (nowEpochMs() / 1000) % periodSeconds
		return (periodSeconds - elapsedInPeriod) / periodSeconds
	})

	const issuerSecond = props.otp.issuer_second.trim()
	const issuerText =
		issuerSecond.length > 0 ? `${props.otp.issuer} (${issuerSecond})` : props.otp.issuer

	async function toggleCodeVisibility() {
		if (isCodeVisible()) {
			setCode(null)
			setIsCodeVisible(false)
			setLastPeriodCounter(null)
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
		setLastPeriodCounter(periodCounter())
	}

	async function refreshVisibleCode() {
		if (!isCodeVisible() || isAutoRefreshingCode) {
			return
		}

		isAutoRefreshingCode = true
		const code_res = await fetch_otp_code(props.otp.id)
		isAutoRefreshingCode = false

		if (!isCodeVisible()) {
			return
		}

		if (Result.isError(code_res)) {
			props.setError(code_res.error.message)
			return
		}

		setCode(code_res.value)
	}

	createEffect(() => {
		if (tickTimer !== undefined) {
			clearInterval(tickTimer)
			tickTimer = undefined
		}

		if (!isCodeVisible()) {
			return
		}

		setNowEpochMs(Date.now())
		tickTimer = setInterval(() => {
			setNowEpochMs(Date.now())
		}, 100)
	})

	createEffect(() => {
		if (!isCodeVisible()) {
			return
		}

		const currentCounter = periodCounter()
		const previousCounter = lastPeriodCounter()

		if (previousCounter === null) {
			setLastPeriodCounter(currentCounter)
			return
		}

		if (currentCounter !== previousCounter) {
			setLastPeriodCounter(currentCounter)
			void refreshVisibleCode()
		}
	})

	onCleanup(() => {
		if (copyToastTimer !== undefined) {
			clearTimeout(copyToastTimer)
		}
		if (tickTimer !== undefined) {
			clearInterval(tickTimer)
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
		if (isLoadingCode()) {
			return
		}

		props.setError(null)
		const fetchedCodeResult = await fetch_otp_code(props.otp.id)
		if (Result.isError(fetchedCodeResult)) {
			props.setError(fetchedCodeResult.error.message)
			return
		}

		const value = Result.unwrap(fetchedCodeResult)
		if (isCodeVisible()) {
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
				disabled={isLoadingCode()}
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
			<div class="otp-list__timer-track" aria-hidden="true">
				<div
					class={`otp-list__timer-fill ${isCodeVisible() ? 'otp-list__timer-fill--active' : ''}`}
					style={{ transform: `scaleX(${remainingRatio()})` }}
				/>
			</div>
		</li>
	)
}

export default OtpListItem
