import { IconChevronRight, IconPencil, IconTrash } from '@tabler/icons-solidjs'
import { useMutation } from '@tanstack/solid-query'
import { Link } from '@tanstack/solid-router'
import { Result } from 'better-result'
import type { TagWithMemberCount } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { create_tag, delete_tag } from '../api'
import { refresh_data, tags_query, use_query } from '../queries'
import type { InputEventAndTarget } from '../types'
import { matchesQuery } from '../util/otp_search'
import { useMainView } from './MainView'
import TagColorInput from './TagColorInput'
import TagEditDialog from './TagEditDialog'

const DEFAULT_COLOR = '#16a34a'

const TagsPage = (): JSX.Element => {
	const { tagSearchQuery } = useMainView()
	const [name, setName] = createSignal('')
	const [color, setColor] = createSignal(DEFAULT_COLOR)
	const [error, setError] = createSignal<string | null>(null)
	const [editingTag, setEditingTag] = createSignal<TagWithMemberCount | null>(null)

	const tags = use_query(tags_query)
	const createTag = useMutation(() => ({
		mutationFn: (tag: { name: string; color: string }) => create_tag(tag.name, tag.color),
	}))
	const shownError = (): string | null => error() ?? tags.error()

	const filteredTags = (): TagWithMemberCount[] =>
		(tags.data() ?? []).filter((tag) => matchesQuery([tag.name], tagSearchQuery()))

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		setError(null)

		const nameVal = name().trim()
		if (!nameVal) {
			setError('Name ist erforderlich')
			return
		}

		const res = await createTag.mutateAsync({ name: nameVal, color: color() })

		if (Result.isError(res)) {
			setError(res.error.message)
			return
		}

		setName('')
		setColor(DEFAULT_COLOR)
		await refresh_data()
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

		await refresh_data()
	}

	return (
		<div class="tags-page">
			<nav aria-label="Seitenpfad">
				<ol class="breadcrumb">
					<li>
						{/* Shares the search input's tabindex, so it follows it in document order */}
						<Link to="/" search={true} tabindex={1}>
							Übersicht
						</Link>
					</li>
					<li aria-hidden="true">
						<IconChevronRight size={16} stroke="2" />
					</li>
					<li aria-current="page">Tags</li>
				</ol>
			</nav>

			<h2>Tags</h2>

			<Show when={shownError()}>
				<div class="app-inline-error">{shownError()}</div>
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
						disabled={createTag.isPending}
						placeholder="z. B. Arbeit"
						required
					/>
				</div>
				<div class="form-group">
					<label for="tag-color">Farbe</label>
					<TagColorInput
						id="tag-color"
						tabindex={3}
						value={color()}
						onInput={setColor}
						disabled={createTag.isPending}
					/>
				</div>
				<button
					type="submit"
					class="login-button"
					tabindex={4}
					disabled={createTag.isPending}
				>
					{createTag.isPending ? 'Erstellen...' : 'Erstellen'}
				</button>
			</form>

			<Show when={!tags.isPending()} fallback={<div>Laden...</div>}>
				<Show
					when={(tags.data() ?? []).length > 0}
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
											onClick={(): void => {
												setEditingTag(tag)
											}}
											aria-label={`Tag ${tag.name} bearbeiten`}
											title="Bearbeiten"
										>
											<IconPencil size={18} stroke="2" aria-hidden="true" />
										</button>
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

			{/* Keyed: the form starts from a snapshot of the tag, which a refetch must not move */}
			<Show when={editingTag()} keyed>
				{(tag: TagWithMemberCount): JSX.Element => (
					<TagEditDialog
						tag={tag}
						onClose={(): void => {
							setEditingTag(null)
						}}
						onSave={async (): Promise<void> => {
							setEditingTag(null)
							await refresh_data()
						}}
					/>
				)}
			</Show>
		</div>
	)
}

export default TagsPage
