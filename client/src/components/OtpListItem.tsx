import { IconEye, IconEyeOff, IconPencil } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { MouseEventAndTarget, OtpDisplayInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createEffect, createSignal, onCleanup, Show } from 'solid-js'
import { fetch_otp_code } from '../api'
import EditDialog from './EditDialog'

type Props = {
	otp: OtpDisplayInfo
	setError: (e: string | null) => void
	refetch: () => Promise<OtpDisplayInfo[]>
}

const OtpListItem = (props: Props): JSX.Element => {
	const [isEditing, setIsEditing] = createSignal(false)
	const [code, setCode] = createSignal<string | null>(null)
	const [isCodeVisible, setIsCodeVisible] = createSignal(false)
	const [isLoadingCode, setIsLoadingCode] = createSignal(false)
	const [showCopyToast, setShowCopyToast] = createSignal(false)
	const [timerAlignmentMs, setTimerAlignmentMs] = createSignal(0)
	let copyToastTimer: ReturnType<typeof setTimeout> | undefined
	let refreshBoundaryTimer: ReturnType<typeof setTimeout> | undefined
	let refreshIntervalTimer: ReturnType<typeof setInterval> | undefined
	let isAutoRefreshingCode = false

	const periodSeconds = Math.max(1, props.otp.period)
	const periodMs = periodSeconds * 1000

	const issuerSecond = props.otp.issuer_second.trim()
	const issuerText =
		issuerSecond.length > 0 ? `${props.otp.issuer} (${issuerSecond})` : props.otp.issuer

	async function toggleCodeVisibility(): Promise<void> {
		if (isCodeVisible()) {
			setCode(null)
			setIsCodeVisible(false)
			setTimerAlignmentMs(0)
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
		setTimerAlignmentMs(Date.now() % periodMs)
		setIsCodeVisible(true)
	}

	async function refreshVisibleCode(): Promise<void> {
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
		if (refreshBoundaryTimer !== undefined) {
			clearTimeout(refreshBoundaryTimer)
			refreshBoundaryTimer = undefined
		}

		if (refreshIntervalTimer !== undefined) {
			clearInterval(refreshIntervalTimer)
			refreshIntervalTimer = undefined
		}

		if (!isCodeVisible()) {
			return
		}

		const msToNextPeriod = periodMs - (Date.now() % periodMs)
		refreshBoundaryTimer = setTimeout(() => {
			void refreshVisibleCode()
			refreshIntervalTimer = setInterval(() => {
				void refreshVisibleCode()
			}, periodMs)
		}, msToNextPeriod)
	})

	onCleanup(() => {
		if (copyToastTimer !== undefined) {
			clearTimeout(copyToastTimer)
		}
		if (refreshBoundaryTimer !== undefined) {
			clearTimeout(refreshBoundaryTimer)
		}
		if (refreshIntervalTimer !== undefined) {
			clearInterval(refreshIntervalTimer)
		}
	})

	function triggerCopyToast(): void {
		setShowCopyToast(true)
		if (copyToastTimer !== undefined) {
			clearTimeout(copyToastTimer)
		}
		copyToastTimer = setTimeout(() => {
			setShowCopyToast(false)
		}, 1400)
	}

	async function copyCodeFromCard(): Promise<void> {
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
				onClick={(event: MouseEventAndTarget): void => {
					event.stopPropagation()
					void copyCodeFromCard()
				}}
				aria-label={`Copy OTP code for ${issuerText}`}
				title="Copy current code"
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
				class="icon-button otp-list__edit"
				onClick={(event: MouseEventAndTarget): void => {
					event.stopPropagation()
					setIsEditing(true)
				}}
				aria-label={`Edit OTP entry for ${issuerText}`}
				title="Edit"
			>
				<IconPencil size={18} stroke="2" />
			</button>
			<button
				type="button"
				class="icon-button otp-list__toggle"
				onClick={(event: MouseEventAndTarget): void => {
					event.stopPropagation()
					void toggleCodeVisibility()
				}}
				aria-label={isCodeVisible() ? 'Hide code' : 'Show code'}
				title={isCodeVisible() ? 'Hide code' : 'Show code'}
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
					style={`--otp-period-seconds:${periodSeconds}s;--otp-offset-seconds:-${timerAlignmentMs() / 1000}s;`}
				/>
			</div>
			<EditDialog
				open={isEditing()}
				otp={props.otp}
				onClose={(): boolean => setIsEditing(false)}
				onSave={async (): Promise<void> => {
					setIsEditing(false)
					await props.refetch()
				}}
			/>
		</li>
	)
}

export default OtpListItem
