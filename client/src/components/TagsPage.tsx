import { IconTrash } from '@tabler/icons-solidjs'
import { Result } from 'better-result'
import type { InputEventAndTarget, TagWithMemberCount } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createResource, createSignal, For, Show } from 'solid-js'
import { create_tag, delete_tag, fetch_tags } from '../api'
import { setTagsChanged } from '../router'
import { makeArrayRefetch } from '../util/resource_helpers'

const DEFAULT_COLOR = '#16a34a'

type TagsPageProps = {
	searchQuery: string
}

const TagsPage = (props: TagsPageProps): JSX.Element => {
	const [name, setName] = createSignal('')
	const [color, setColor] = createSignal(DEFAULT_COLOR)
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)

	const [tags, { refetch }] = createResource(
		async (): Promise<TagWithMemberCount[]> => {
			const res = await fetch_tags()
			if (Result.isError(res)) {
				setError(res.error.message)
				return []
			}
			return res.value
		},
		{ initialValue: [] },
	)
	const refetchTyped = makeArrayRefetch<TagWithMemberCount>(refetch)

	const filteredTags = (): TagWithMemberCount[] => {
		const query = props.searchQuery.trim().toLocaleLowerCase()
		if (query.length === 0) {
			return tags()
		}
		return tags().filter((tag) => tag.name.toLocaleLowerCase().includes(query))
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
		const res = await create_tag(nameVal, color())
		setSubmitting(false)

		if (Result.isError(res)) {
			setError(res.error.message)
			return
		}

		setName('')
		setColor(DEFAULT_COLOR)
		await refetchTyped()
		setTagsChanged(true)
	}

	async function handleDelete(tag: TagWithMemberCount): Promise<void> {
		if (!confirm(`Tag "${tag.name}" wirklich löschen?`)) {
			return
		}

		setError(null)
		const res = await delete_tag(tag.id)
		if (Result.isError(res)) {
			setError(res.error.message)
			return
		}

		await refetchTyped()
		setTagsChanged(true)
	}

	return (
		<div class="tags-page">
			<h2>Tags</h2>

			<Show when={error()}>
				<div class="app-inline-error">{error()}</div>
			</Show>

			<form class="tags-create-form" onSubmit={handleSubmit}>
				<div class="form-group">
					<label for="tag-name">Name</label>
					<input
						id="tag-name"
						type="text"
						tabindex={2}
						value={name()}
						onInput={(e: InputEventAndTarget): void => {
							setName(e.currentTarget.value)
						}}
						disabled={submitting()}
						placeholder="z. B. Arbeit"
						required
					/>
				</div>
				<div class="form-group">
					<label for="tag-color">Farbe</label>
					<input
						id="tag-color"
						type="color"
						tabindex={3}
						value={color()}
						onInput={(e: InputEventAndTarget): void => {
							setColor(e.currentTarget.value)
						}}
						disabled={submitting()}
					/>
				</div>
				<button type="submit" class="login-button" tabindex={4} disabled={submitting()}>
					{submitting() ? 'Erstellen...' : 'Erstellen'}
				</button>
			</form>

			<Show when={!tags.loading} fallback={<div>Laden...</div>}>
				<Show
					when={tags().length > 0}
					fallback={
						<div class="tag-list__empty" role="status" aria-live="polite">
							Keine Tags vorhanden.
						</div>
					}
				>
					<Show
						when={filteredTags().length > 0}
						fallback={
							<div class="tag-list__empty" role="status" aria-live="polite">
								Keine passenden Tags gefunden.
							</div>
						}
					>
						<ul class="tag-list">
							<For each={filteredTags()}>
								{(tag: TagWithMemberCount): JSX.Element => (
									<li class="tag-list__item">
										<span class="tag-chip" style={{ '--tag-color': tag.color }}>
											{tag.name}
										</span>
										<span class="tag-list__count">
											{tag.member_count === 1
												? '1 Eintrag'
												: `${tag.member_count} Einträge`}
										</span>
										<button
											type="button"
											class="icon-button"
											tabindex={5}
											onClick={(): Promise<void> => handleDelete(tag)}
											aria-label={`Tag ${tag.name} löschen`}
											title="Löschen"
										>
											<IconTrash size={18} stroke="2" aria-hidden="true" />
										</button>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</Show>
			</Show>
		</div>
	)
}

export default TagsPage
