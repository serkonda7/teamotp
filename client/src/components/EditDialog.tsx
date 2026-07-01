import { IconX } from '@tabler/icons-solidjs'
import type { InputEventAndTarget, OtpDisplayInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { client } from '../api'
import { read_api_error } from '../util/api_error'

type EditDialogProps = {
	open: boolean
	otp: OtpDisplayInfo
	onClose: () => void
	onSave: () => Promise<void>
}

type FormFieldProps = {
	id: string
	label: string
	value: string
	changed: boolean
	disabled: boolean
	colClass: string
	placeholder?: string
	required?: boolean
	onInput: (value: string) => void
}

const FormField = (props: FormFieldProps): JSX.Element => (
	<div class="form-row">
		<div class={`form-group ${props.colClass}`}>
			<label for={props.id} classList={{ 'field-changed': props.changed }}>
				<Show when={props.changed}>
					<i>* </i>
				</Show>
				{props.label}
			</label>
			<input
				id={props.id}
				type="text"
				value={props.value}
				onInput={(e: InputEventAndTarget): void => props.onInput(e.currentTarget.value)}
				disabled={props.disabled}
				required={props.required}
				placeholder={props.placeholder}
			/>
		</div>
	</div>
)

function DialogContent(props: EditDialogProps): JSX.Element {
	const [label, setLabel] = createSignal(props.otp.label)
	const [issuer, setIssuer] = createSignal(props.otp.issuer)
	const [issuerSecond, setIssuerSecond] = createSignal(props.otp.issuer_second)
	const usageCount = props.otp.usage_count.toString()
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)

	const isIssuerChanged = (): boolean => issuer().trim() !== props.otp.issuer
	const isIssuerSecondChanged = (): boolean => issuerSecond().trim() !== props.otp.issuer_second
	const isLabelChanged = (): boolean => label().trim() !== props.otp.label
	const hasChanges = (): boolean =>
		isIssuerChanged() || isIssuerSecondChanged() || isLabelChanged()

	function handleClose(): void {
		if (hasChanges()) {
			if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
				return
			}
		}
		props.onClose()
	}

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		setError(null)

		const labelVal = label().trim()
		if (!labelVal) {
			setError('Label is required')
			return
		}

		setSubmitting(true)
		try {
			// biome-ignore lint/suspicious/noExplicitAny: Hono RPC POST with params does not infer json parameter without server schema validator
			const res = await (client.otp[':id'].$post as any)({
				param: { id: props.otp.id },
				json: {
					label: labelVal,
					issuer: issuer().trim(),
					issuer_second: issuerSecond().trim(),
				},
			})

			if (!res.ok) {
				const msg = await read_api_error(res, 'Failed to update OTP entry')
				setError(msg)
				return
			}

			await props.onSave()
		} catch (_err) {
			setError('An error occurred while saving.')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div class="modal-backdrop" role="presentation">
			<button
				type="button"
				class="modal-dismiss"
				aria-label="Close edit dialog"
				onClick={handleClose}
			/>
			<div
				class="modal-card modal-card--wide"
				role="dialog"
				aria-modal="true"
				aria-label="Edit OTP entry"
			>
				<button
					type="button"
					class="icon-button modal-close"
					aria-label="Close edit dialog"
					onClick={handleClose}
				>
					<IconX size={18} stroke="2" aria-hidden="true" />
				</button>

				<h2 style={{ 'margin-bottom': '1rem' }}>Edit OTP Entry</h2>

				<Show when={error()}>
					<div class="login-error" style={{ 'margin-bottom': '1rem' }}>
						{error()}
					</div>
				</Show>

				<form class="login-form" onSubmit={handleSubmit}>
					<FormField
						id="edit-issuer"
						label="Issuer"
						value={issuer()}
						changed={isIssuerChanged()}
						disabled={submitting()}
						colClass="col-6"
						placeholder="e.g. Microsoft"
						onInput={setIssuer}
					/>
					<FormField
						id="edit-issuer-second"
						label="Secondary Issuer"
						value={issuerSecond()}
						changed={isIssuerSecondChanged()}
						disabled={submitting()}
						colClass="col-6"
						placeholder="e.g. Musterfirma GmbH"
						onInput={setIssuerSecond}
					/>
					<FormField
						id="edit-label"
						label="Label"
						value={label()}
						changed={isLabelChanged()}
						disabled={submitting()}
						colClass="col-12"
						placeholder="e.g. user@gmail.com"
						required
						onInput={setLabel}
					/>
					<p class="edit-dialog__usage-count">Usage count: {usageCount}</p>
					<div class="form-actions">
						<button
							type="submit"
							class="login-button"
							disabled={submitting()}
							classList={{ 'button-changed': hasChanges() }}
						>
							<Show when={hasChanges()}>
								<i>* </i>
							</Show>
							{submitting() ? 'Saving...' : 'Save'}
						</button>
						<button
							type="button"
							class="cancel-button"
							onClick={handleClose}
							disabled={submitting()}
						>
							Cancel
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

const EditDialog = (props: EditDialogProps): JSX.Element => (
	<Show when={props.open}>
		<DialogContent {...props} />
	</Show>
)

export default EditDialog
