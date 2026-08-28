import { IconEye, IconEyeOff, IconPencil } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { MouseEventAndTarget, OtpDisplayInfo, TagInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { fetch_otp_code } from '../api'
import EditDialog from './EditDialog'

type Props = {
	otp: OtpDisplayInfo
	setError: (e: string | null) => void
	refetch: () => Promise<OtpDisplayInfo[]>
	autoFocus?: boolean
	onFocused?: () => void
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

	let copyRef: HTMLButtonElement | undefined
	let editRef: HTMLButtonElement | undefined
	let toggleRef: HTMLButtonElement | undefined

	function focusableEntryButtons(): HTMLButtonElement[] {
		return [copyRef, editRef, toggleRef].filter(
			(b): b is HTMLButtonElement => b !== undefined && !b.disabled,
		)
	}

	type EntryKeyboardEvent = KeyboardEvent & { currentTarget: HTMLButtonElement }

	function handleEntryArrowKey(event: EntryKeyboardEvent): void {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
			return
		}
		event.preventDefault()
		const list = focusableEntryButtons()
		const idx = list.indexOf(event.currentTarget)
		if (idx === -1) {
			return
		}
		const dir = event.key === 'ArrowRight' ? 1 : -1
		const next = list[(idx + dir + list.length) % list.length]
		next?.focus()
	}

	createEffect(() => {
		if (props.autoFocus && copyRef) {
			copyRef.focus()
			copyRef.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
			props.onFocused?.()
		}
	})

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
			props.setError('OTP-Code konnte nicht in die Zwischenablage kopiert werden')
		}
	}

	return (
		<li class="otp-list__item" data-otp-id={props.otp.id}>
			<button
				type="button"
				ref={copyRef}
				class="otp-list__copy"
				tabindex={2}
				onClick={(event: MouseEventAndTarget): void => {
					event.stopPropagation()
					void copyCodeFromCard()
				}}
				onKeyDown={handleEntryArrowKey}
				aria-label={`OTP-Code für ${issuerText} kopieren`}
				title="Aktuellen Code kopieren"
				disabled={isLoadingCode()}
			/>
			<div class="otp-list__content">
				<span class="otp-list__issuer">{issuerText}</span>
				<span
					class={`otp-list__secondary ${isCodeVisible() && code() !== null ? 'otp-list__secondary--code' : ''}`}
				>
					{isCodeVisible() && code() !== null ? code() : props.otp.label}
				</span>
				<Show when={props.otp.tags.length > 0}>
					<span class="otp-list__tags">
						<For each={props.otp.tags}>
							{(tag: TagInfo): JSX.Element => (
								<span class="tag-chip" style={{ '--tag-color': tag.color }}>
									{tag.name}
								</span>
							)}
						</For>
					</span>
				</Show>
			</div>
			<button
				type="button"
				ref={editRef}
				class="icon-button otp-list__edit"
				tabindex={-1}
				onClick={(event: MouseEventAndTarget): void => {
					event.stopPropagation()
					setIsEditing(true)
				}}
				onKeyDown={handleEntryArrowKey}
				aria-label={`Eintrag für ${issuerText} bearbeiten`}
				title="Bearbeiten"
			>
				<IconPencil size={18} stroke="2" />
			</button>
			<button
				type="button"
				ref={toggleRef}
				class="icon-button otp-list__toggle"
				tabindex={-1}
				onClick={(event: MouseEventAndTarget): void => {
					event.stopPropagation()
					void toggleCodeVisibility()
				}}
				onKeyDown={handleEntryArrowKey}
				aria-label={isCodeVisible() ? 'Code ausblenden' : 'Code anzeigen'}
				title={isCodeVisible() ? 'Code ausblenden' : 'Code anzeigen'}
				disabled={isLoadingCode()}
			>
				<Show when={isCodeVisible()} fallback={<IconEye size={18} />}>
					<IconEyeOff size={18} />
				</Show>
			</button>
			<Show when={showCopyToast()}>
				<div class="otp-list__copy-toast" role="status" aria-live="polite">
					Kopiert!
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
				onClose={(): void => {
					setIsEditing(false)
				}}
				onSave={async (): Promise<void> => {
					setIsEditing(false)
					await props.refetch()
				}}
			/>
		</li>
	)
}

export default OtpListItem
