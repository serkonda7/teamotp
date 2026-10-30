import { IconArchive, IconX } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { OtpDisplayInfo, TagWithMemberCount } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js'
import { archive_entry, fetch_entry_tags, set_entry_tag, update_entry } from '../api'
import { tags_query, use_query } from '../queries'
import type { InputEventAndTarget } from '../types'
import TagSelectMark from './TagSelectMark'

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

/** Returns a copy of `set` with `id` added (`on`) or removed (`!on`). */
function withToggled(set: ReadonlySet<string>, id: string, on: boolean): Set<string> {
	const next = new Set(set)
	if (on) {
		next.add(id)
	} else {
		next.delete(id)
	}
	return next
}

// visible=false hides the asterisk but reserves its space (unlike <Show>),
// so toggling it never shifts surrounding content.
export const Asterisk = (props: { visible?: boolean }): JSX.Element => (
	<span style={{ visibility: props.visible === false ? 'hidden' : 'visible' }}>* </span>
)

export const FormField = (props: FormFieldProps): JSX.Element => (
	<div class="form-row">
		<div class={`form-group ${props.colClass}`}>
			<label for={props.id} classList={{ 'field-changed': props.changed }}>
				<Show when={props.changed}>
					<Asterisk />
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
	const [assignedTagIds, setAssignedTagIds] = createSignal<ReadonlySet<string>>(new Set())
	const [initialTagIds, setInitialTagIds] = createSignal<ReadonlySet<string>>(new Set())

	const tags = use_query(tags_query)
	const allTags = (): TagWithMemberCount[] => tags.data() ?? []
	const shownError = (): string | null => error() ?? tags.error()

	// Read once instead of through a query: this is the baseline of the form, which
	// a background refetch must not move while the user is editing
	onMount(async () => {
		const entryTagsRes = await fetch_entry_tags(props.otp.id)

		if (Result.isError(entryTagsRes)) {
			setError(entryTagsRes.error.message)
			return
		}
		const tagIds = new Set(entryTagsRes.value.map((tag) => tag.id))
		setInitialTagIds(tagIds)
		setAssignedTagIds(tagIds)
	})

	function handleTagToggle(tagId: string, assigned: boolean): void {
		setError(null)

		setAssignedTagIds(withToggled(assignedTagIds(), tagId, assigned))
	}

	const isIssuerChanged = (): boolean => issuer().trim() !== props.otp.issuer
	const isIssuerSecondChanged = (): boolean => issuerSecond().trim() !== props.otp.issuer_second
	const isLabelChanged = (): boolean => label().trim() !== props.otp.label
	// Tag IDs to assign and unassign to get from the saved state to the current one
	const tagDiff = createMemo(() => {
		const initial = initialTagIds()
		const current = assignedTagIds()
		return {
			added: [...current].filter((id) => !initial.has(id)),
			removed: [...initial].filter((id) => !current.has(id)),
		}
	})
	const isTagsChanged = (): boolean => {
		const { added, removed } = tagDiff()
		return added.length > 0 || removed.length > 0
	}
	const hasChanges = (): boolean =>
		isIssuerChanged() || isIssuerSecondChanged() || isLabelChanged() || isTagsChanged()

	function handleClose(): void {
		if (hasChanges()) {
			if (!confirm('Ungespeicherte Änderungen wirklich verwerfen?')) {
				return
			}
		}
		props.onClose()
	}

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			handleClose()
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeyDown)
		onCleanup(() => {
			document.removeEventListener('keydown', handleKeyDown)
		})
	})

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
			// Update tag assignments first: their baseline (initialTagIds) is
			// tracked locally, so if the OTP update below fails afterwards,
			// hasChanges() will not report already-persisted tags as unsaved.
			const { added, removed } = tagDiff()
			const tagUpdates = [
				...added.map((tagId) => ({ tagId, assigned: true })),
				...removed.map((tagId) => ({ tagId, assigned: false })),
			]
			for (const { tagId, assigned } of tagUpdates) {
				const tagRes = await set_entry_tag(props.otp.id, tagId, assigned)
				if (Result.isError(tagRes)) {
					setError(tagRes.error.message)
					return
				}
				setInitialTagIds((prev) => withToggled(prev, tagId, assigned))
			}

			const res = await update_entry(props.otp.id, {
				label: labelVal,
				issuer: issuer().trim(),
				issuer_second: issuerSecond().trim(),
			})

			if (Result.isError(res)) {
				setError(res.error.message)
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
				`"${props.otp.issuer} (${props.otp.issuer_second}): ${props.otp.label}" wirklich archivieren?`,
			)
		) {
			return
		}

		setError(null)
		setSubmitting(true)
		try {
			const res = await archive_entry(props.otp.id)

			if (Result.isError(res)) {
				setError(res.error.message)
				return
			}

			await props.onSave()
		} catch (_err) {
			setError('Fehler beim Archivieren.')
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

				<Show when={shownError()}>
					<div class="login-error" style={{ 'margin-bottom': '1rem' }}>
						{shownError()}
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
							<span
								class="edit-tags__label"
								classList={{ 'field-changed': isTagsChanged() }}
							>
								<Show when={isTagsChanged()}>
									<Asterisk />
								</Show>
								Tags
							</span>
							<For each={allTags()}>
								{(tag: TagWithMemberCount): JSX.Element => (
									<label
										class="tag-chip edit-tags__option"
										classList={{
											'tag-chip--selected': assignedTagIds().has(tag.id),
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
												handleTagToggle(tag.id, e.currentTarget.checked)
											}}
										/>
										<TagSelectMark selected={assignedTagIds().has(tag.id)} />
										{tag.name}
									</label>
								)}
							</For>
						</div>
					</Show>

					<div class="form-actions">
						<button
							type="button"
							class="archive-button"
							onClick={(): Promise<void> => handleArchive()}
							disabled={submitting()}
							aria-label="Archivieren"
							title="Archivieren"
						>
							<IconArchive size={18} stroke="2" aria-hidden="true" />
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
							type="submit"
							class="login-button"
							disabled={submitting()}
							classList={{ 'button-changed': hasChanges() }}
						>
							<Asterisk visible={hasChanges()} />
							{submitting() ? 'Speichern...' : 'Speichern'}
							{/* Balance spacer: matches the reserved asterisk slot so the
						label stays centered whether or not changes exist */}
							<Asterisk visible={false} />
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
