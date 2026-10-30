import { IconX } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { TagInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createSignal, onCleanup, onMount, Show } from 'solid-js'
import { update_tag } from '../api'
import type { InputEventAndTarget } from '../types'
import { Asterisk, FormField } from './EditDialog'

type TagEditDialogProps = {
	tag: TagInfo
	onClose: () => void
	onSave: () => Promise<void>
}

const TagEditDialog = (props: TagEditDialogProps): JSX.Element => {
	const [name, setName] = createSignal(props.tag.name)
	const [color, setColor] = createSignal(props.tag.color)
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)

	const isNameChanged = (): boolean => name().trim() !== props.tag.name
	const isColorChanged = (): boolean => color() !== props.tag.color
	const hasChanges = (): boolean => isNameChanged() || isColorChanged()

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

		const nameVal = name().trim()
		if (!nameVal) {
			setError('Name ist erforderlich')
			return
		}

		setSubmitting(true)
		try {
			const res = await update_tag(props.tag.id, { name: nameVal, color: color() })

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

	return (
		<div class="modal-backdrop" role="presentation">
			<button
				type="button"
				class="modal-dismiss"
				aria-label="Dialog schließen"
				onClick={handleClose}
			/>
			<div
				class="modal-card tag-edit-dialog"
				role="dialog"
				aria-modal="true"
				aria-label="Tag bearbeiten"
			>
				<button
					type="button"
					class="icon-button modal-close"
					aria-label="Dialog schließen"
					onClick={handleClose}
				>
					<IconX size={18} stroke="2" aria-hidden="true" />
				</button>

				<h2 style={{ 'margin-bottom': '1rem' }}>Tag bearbeiten</h2>

				<Show when={error()}>
					<div class="login-error" style={{ 'margin-bottom': '1rem' }}>
						{error()}
					</div>
				</Show>

				<form class="login-form" onSubmit={handleSubmit}>
					<FormField
						id="edit-tag-name"
						label="Name"
						value={name()}
						changed={isNameChanged()}
						disabled={submitting()}
						colClass="col-12"
						placeholder="z. B. Arbeit"
						required
						onInput={setName}
					/>
					<div class="form-row">
						<div class="form-group col-12">
							<label
								for="edit-tag-color"
								classList={{ 'field-changed': isColorChanged() }}
							>
								<Show when={isColorChanged()}>
									<Asterisk />
								</Show>
								Farbe
							</label>
							<input
								id="edit-tag-color"
								type="color"
								value={color()}
								onInput={(e: InputEventAndTarget): void => {
									setColor(e.currentTarget.value)
								}}
								disabled={submitting()}
							/>
						</div>
					</div>

					<div class="form-actions">
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
							<Asterisk visible={false} />
						</button>
					</div>
				</form>
			</div>
		</div>
	)
}

export default TagEditDialog
