import { Modal } from '@serkonda7/solid-components'
import { Result } from 'better-result'
import type { TagInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createSignal, Show } from 'solid-js'
import { update_tag } from '../api'
import { Asterisk, FormField } from './EditDialog'
import TagColorInput from './TagColorInput'

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

	const confirmDiscard = (): boolean =>
		!hasChanges() || confirm('Ungespeicherte Änderungen wirklich verwerfen?')

	function handleCancel(): void {
		if (confirmDiscard()) {
			props.onClose()
		}
	}

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
		<Modal
			open
			class="tag-edit-dialog"
			title="Tag bearbeiten"
			closeLabel="Dialog schließen"
			onBeforeClose={confirmDiscard}
			onClose={props.onClose}
		>
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
						<TagColorInput
							id="edit-tag-color"
							value={color()}
							onInput={setColor}
							disabled={submitting()}
						/>
					</div>
				</div>

				<div class="form-actions">
					<button
						type="button"
						class="cancel-button"
						onClick={handleCancel}
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
		</Modal>
	)
}

export default TagEditDialog
