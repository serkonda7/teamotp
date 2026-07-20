import { IconX } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { InputEventAndTarget, OtpDisplayInfo, TagWithMemberCount } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import { client, fetch_entry_tags, fetch_tags, set_entry_tag } from '../api'
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
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)
	const [allTags, setAllTags] = createSignal<TagWithMemberCount[]>([])
	const [assignedTagIds, setAssignedTagIds] = createSignal<ReadonlySet<string>>(new Set())

	onMount(async () => {
		const [tagsRes, entryTagsRes] = await Promise.all([
			fetch_tags(),
			fetch_entry_tags(props.otp.id),
		])

		if (Result.isError(tagsRes)) {
			setError(tagsRes.error.message)
			return
		}
		setAllTags(tagsRes.value)

		if (Result.isError(entryTagsRes)) {
			setError(entryTagsRes.error.message)
			return
		}
		setAssignedTagIds(new Set(entryTagsRes.value.map((tag) => tag.id)))
	})

	async function handleTagToggle(tagId: string, assigned: boolean): Promise<void> {
		setError(null)

		const next = new Set(assignedTagIds())
		if (assigned) {
			next.add(tagId)
		} else {
			next.delete(tagId)
		}
		setAssignedTagIds(next)

		const res = await set_entry_tag(props.otp.id, tagId, assigned)
		if (Result.isError(res)) {
			setAssignedTagIds(current => {
				const reverted = new Set(current)
				if (assigned) {
					reverted.delete(tagId)
				} else {
					reverted.add(tagId)
				}
				return reverted
			})
			setError(res.error.message)
		}
	}

	const isIssuerChanged = (): boolean => issuer().trim() !== props.otp.issuer
	const isIssuerSecondChanged = (): boolean => issuerSecond().trim() !== props.otp.issuer_second
	const isLabelChanged = (): boolean => label().trim() !== props.otp.label
	const hasChanges = (): boolean =>
		isIssuerChanged() || isIssuerSecondChanged() || isLabelChanged()

	function handleClose(): void {
		if (hasChanges()) {
			if (!confirm('Ungespeicherte Änderungen wirklich verwerfen?')) {
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
			setError('Konto ist erforderlich')
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
				const msg = await read_api_error(res, 'Fehler beim Update des Eintrags')
				setError(msg)
				return
			}

			await props.onSave()
		} catch (_err) {
			setError('Fehler beim Speichern.')
		} finally {
			setSubmitting(false)
		}
	}

	async function handleArchive(): Promise<void> {
		if (
			!confirm(
				`Archive "${props.otp.issuer} (${props.otp.issuer_second}): ${props.otp.label}"?`,
			)
		) {
			return
		}

		setError(null)
		setSubmitting(true)
		try {
			// biome-ignore lint/suspicious/noExplicitAny: Hono RPC POST with params does not infer json parameter without server schema validator
			const res = await (client.otp[':id'].archive.$post as any)({
				param: { id: props.otp.id },
			})

			if (!res.ok) {
				const msg = await read_api_error(res, 'Failed to archive OTP entry')
				setError(msg)
				return
			}

			await props.onSave()
		} catch (_err) {
			setError('An error occurred while archiving.')
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div class="modal-backdrop" role="presentation">
			<button
				type="button"
				class="modal-dismiss"
				aria-label="Dialog schließen"
				onClick={handleClose}
			/>
			<div
				class="modal-card modal-card--wide"
				role="dialog"
				aria-modal="true"
				aria-label="OTP-Eintrag bearbeiten"
			>
				<button
					type="button"
					class="icon-button modal-close"
					aria-label="Dialog schließen"
					onClick={handleClose}
				>
					<IconX size={18} stroke="2" aria-hidden="true" />
				</button>

				<h2 style={{ 'margin-bottom': '1rem' }}>Eintrag bearbeiten</h2>

				<Show when={error()}>
					<div class="login-error" style={{ 'margin-bottom': '1rem' }}>
						{error()}
					</div>
				</Show>

				<form class="login-form" onSubmit={handleSubmit}>
					<FormField
						id="edit-issuer"
						label="Anbieter"
						value={issuer()}
						changed={isIssuerChanged()}
						disabled={submitting()}
						colClass="col-6"
						placeholder="z. B. Microsoft"
						onInput={setIssuer}
					/>
					<FormField
						id="edit-issuer-second"
						label="Firma / zweiter Anbieter"
						value={issuerSecond()}
						changed={isIssuerSecondChanged()}
						disabled={submitting()}
						colClass="col-6"
						placeholder="z. B. Musterfirma GmbH"
						onInput={setIssuerSecond}
					/>
					<FormField
						id="edit-label"
						label="Konto"
						value={label()}
						changed={isLabelChanged()}
						disabled={submitting()}
						colClass="col-12"
						placeholder="z. B. user@gmail.com"
						required
						onInput={setLabel}
					/>

					<Show when={allTags().length > 0}>
						<div class="edit-tags">
							<span class="edit-tags__label">Tags</span>
							<For each={allTags()}>
								{(tag: TagWithMemberCount): JSX.Element => (
									<label
										class="tag-chip edit-tags__option"
										classList={{
											'edit-tags__option--assigned': assignedTagIds().has(
												tag.id,
											),
										}}
										style={{ '--tag-color': tag.color }}
									>
										<input
											type="checkbox"
											checked={assignedTagIds().has(tag.id)}
											disabled={submitting()}
											onChange={(
												e: Event & { currentTarget: HTMLInputElement },
											): void => {
												void handleTagToggle(
													tag.id,
													e.currentTarget.checked,
												)
											}}
										/>
										{tag.name}
									</label>
								)}
							</For>
						</div>
					</Show>

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
							{submitting() ? 'Speichern...' : 'Speichern'}
						</button>
						<button
							type="button"
							class="cancel-button"
							onClick={handleClose}
							disabled={submitting()}
						>
							Abbrechen
						</button>
						<button
							type="button"
							class="archive-button"
							onClick={(): Promise<void> => handleArchive()}
							disabled={submitting()}
						>
							Archivieren
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
