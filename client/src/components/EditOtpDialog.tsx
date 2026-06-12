import { IconX } from '@tabler/icons-solidjs'
import type { OtpDisplayInfo } from 'shared/src/types'
import { createSignal, Show } from 'solid-js'
import { client } from '../api'
import { read_api_error } from '../util/api_error'

type EditOtpDialogProps = {
	open: boolean
	otp: OtpDisplayInfo
	onClose: () => void
	onSave: () => Promise<void>
}

const EditOtpDialog = (props: EditOtpDialogProps) => {
	const [label, setLabel] = createSignal(props.otp.label)
	const [issuer, setIssuer] = createSignal(props.otp.issuer)
	const [issuerSecond, setIssuerSecond] = createSignal(props.otp.issuer_second)
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)

	const isIssuerChanged = () => issuer().trim() !== props.otp.issuer
	const isIssuerSecondChanged = () => issuerSecond().trim() !== props.otp.issuer_second
	const isLabelChanged = () => label().trim() !== props.otp.label
	const hasChanges = () => isIssuerChanged() || isIssuerSecondChanged() || isLabelChanged()

	function handleClose() {
		if (hasChanges()) {
			if (!confirm('You have unsaved changes. Are you sure you want to discard them?')) {
				return
			}
		}
		props.onClose()
	}

	async function handleSubmit(e: SubmitEvent) {
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
		<Show when={props.open}>
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
						<div class="form-row">
							<div class="form-group col-6">
								<label
									for="edit-issuer"
									classList={{ 'field-changed': isIssuerChanged() }}
								>
									<Show when={isIssuerChanged()}>
										<i>* </i>
									</Show>
									Issuer
								</label>
								<input
									id="edit-issuer"
									type="text"
									value={issuer()}
									onInput={(e) => setIssuer(e.currentTarget.value)}
									disabled={submitting()}
									placeholder="e.g. Microsoft"
								/>
							</div>
						</div>

						<div class="form-row">
							<div class="form-group col-6">
								<label
									for="edit-issuer-second"
									classList={{ 'field-changed': isIssuerSecondChanged() }}
								>
									<Show when={isIssuerSecondChanged()}>
										<i>* </i>
									</Show>
									Secondary Issuer
								</label>
								<input
									id="edit-issuer-second"
									type="text"
									value={issuerSecond()}
									onInput={(e) => setIssuerSecond(e.currentTarget.value)}
									disabled={submitting()}
									placeholder="e.g. Musterfirma GmbH"
								/>
							</div>
						</div>

						<div class="form-row">
							<div class="form-group col-12">
								<label
									for="edit-label"
									classList={{ 'field-changed': isLabelChanged() }}
								>
									<Show when={isLabelChanged()}>
										<i>* </i>
									</Show>
									Label
								</label>
								<input
									id="edit-label"
									type="text"
									value={label()}
									onInput={(e) => setLabel(e.currentTarget.value)}
									disabled={submitting()}
									required
									placeholder="e.g. user@gmail.com"
								/>
							</div>
						</div>

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
		</Show>
	)
}

export default EditOtpDialog
