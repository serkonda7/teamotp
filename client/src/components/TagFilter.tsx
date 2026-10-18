import { IconFilter2, IconX } from '@tabler/icons-solidjs'
import type { TagInfo } from 'shared/src/types'
import { createEffect, createMemo, createSignal, For, type JSX, onCleanup, Show } from 'solid-js'
import TagSelectMark from './TagSelectMark'

type Props = {
	tags: TagInfo[]
	activeTagIds: string[]
	onToggle: (tagId: string) => void
}

type TagChipProps = {
	tag: TagInfo
	isActive: () => boolean
	onToggle: (tagId: string) => void
}

const TagChip = (props: TagChipProps): JSX.Element => {
	const isActive = createMemo(props.isActive)
	return (
		<button
			type="button"
			class="tag-chip tag-filter__chip"
			tabindex={4}
			classList={{ 'tag-chip--selected': isActive() }}
			style={{ '--tag-color': props.tag.color }}
			onClick={(): void => props.onToggle(props.tag.id)}
			aria-pressed={isActive()}
			title={`Nach Tag "${props.tag.name}" filtern`}
		>
			<TagSelectMark selected={isActive()} />
			{props.tag.name}
		</button>
	)
}

type TagFilterButtonProps = {
	buttonRef: (el: HTMLButtonElement) => void
	badgeCount: number
	isOpen: () => boolean
	hasActiveTags: () => boolean
	onToggle: () => void
}

const TagFilterButton = (props: TagFilterButtonProps): JSX.Element => (
	<button
		type="button"
		ref={props.buttonRef}
		class="icon-button tag-filter__button"
		tabindex={4}
		classList={{ 'tag-filter__button--active': props.hasActiveTags() }}
		onClick={props.onToggle}
		aria-label="Nach Tags filtern"
		aria-expanded={props.isOpen()}
		title="Nach Tags filtern"
	>
		<IconFilter2 size={18} stroke="2" aria-hidden="true" />
		<Show when={props.hasActiveTags()}>
			<span class="tag-filter__badge">{props.badgeCount}</span>
		</Show>
	</button>
)

type TagFilterPopoverProps = {
	tags: TagInfo[]
	activeTagIds: string[]
	onToggle: (tagId: string) => void
}

// Below this many tags a search field inside the popover is just noise
const TAG_SEARCH_MIN_TAGS = 8

const TagFilterPopover = (props: TagFilterPopoverProps): JSX.Element => {
	const [query, setQuery] = createSignal('')
	const visibleTags = createMemo(() => {
		const needle = query().trim().toLowerCase()
		return needle === ''
			? props.tags
			: props.tags.filter((tag) => tag.name.toLowerCase().includes(needle))
	})

	return (
		<div class="tag-filter__popover">
			<div class="tag-filter__header">
				<span class="tag-filter__title">
					Tags
					<Show when={props.activeTagIds.length > 0}>
						<span class="tag-filter__count">
							{props.activeTagIds.length} von {props.tags.length}
						</span>
					</Show>
				</span>
			</div>
			<Show when={props.tags.length >= TAG_SEARCH_MIN_TAGS}>
				<input
					type="search"
					class="tag-filter__search"
					tabindex={4}
					placeholder="Tags durchsuchen"
					aria-label="Tags durchsuchen"
					value={query()}
					onInput={(event: InputEvent & { currentTarget: HTMLInputElement }): void => {
						setQuery(event.currentTarget.value)
					}}
				/>
			</Show>
			<div class="tag-filter__chips">
				<For
					each={visibleTags()}
					fallback={<span class="tag-filter__empty">Keine Tags gefunden</span>}
				>
					{(tag: TagInfo): JSX.Element => (
						<TagChip
							tag={tag}
							isActive={(): boolean => props.activeTagIds.includes(tag.id)}
							onToggle={props.onToggle}
						/>
					)}
				</For>
			</div>
		</div>
	)
}

const TagFilter = (props: Props): JSX.Element => {
	const [open, setOpen] = createSignal(false)
	let rootRef: HTMLDivElement | undefined
	let buttonRef: HTMLButtonElement | undefined

	const close = (): void => {
		setOpen(false)
	}
	const hasActiveTags = (): boolean => props.activeTagIds.length > 0

	const handlePointerDown = (event: PointerEvent): void => {
		if (rootRef && !rootRef.contains(event.target as Node)) {
			close()
		}
	}
	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			close()
			buttonRef?.focus()
		}
	}

	// Close the popover on outside click or Escape
	const removeListeners = (): void => {
		document.removeEventListener('pointerdown', handlePointerDown)
		document.removeEventListener('keydown', handleKeyDown)
	}
	createEffect(() => {
		if (!open()) {
			return
		}
		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		onCleanup(removeListeners)
	})

	return (
		<div class="tag-filter" ref={rootRef}>
			<TagFilterButton
				buttonRef={(el: HTMLButtonElement): void => {
					buttonRef = el
				}}
				badgeCount={props.activeTagIds.length}
				isOpen={open}
				hasActiveTags={hasActiveTags}
				onToggle={(): void => {
					setOpen((prev) => !prev)
				}}
			/>
			<Show when={open()}>
				<TagFilterPopover
					tags={props.tags}
					activeTagIds={props.activeTagIds}
					onToggle={props.onToggle}
				/>
			</Show>
		</div>
	)
}

type TagFilterPillsProps = {
	tags: TagInfo[]
	activeTagIds: string[]
	onToggle: (tagId: string) => void
	onClear: () => void
}

/** Applied tag filters as removable pills, so they stay visible with the popover closed. */
export const TagFilterPills = (props: TagFilterPillsProps): JSX.Element => {
	const activeTags = createMemo(() =>
		props.tags.filter((tag) => props.activeTagIds.includes(tag.id)),
	)

	return (
		<Show when={activeTags().length > 0}>
			<ul class="tag-filter-pills" aria-label="Aktive Tag-Filter">
				<Show when={activeTags().length > 1}>
					<li>
						<button
							type="button"
							class="tag-filter-pills__clear"
							tabindex={4}
							onClick={props.onClear}
						>
							Alle entfernen
						</button>
					</li>
				</Show>
				<For each={activeTags()}>
					{(tag: TagInfo): JSX.Element => (
						<li>
							<button
								type="button"
								class="tag-chip tag-filter-pills__pill"
								tabindex={4}
								style={{ '--tag-color': tag.color }}
								onClick={(): void => props.onToggle(tag.id)}
								aria-label={`Filter "${tag.name}" entfernen`}
								title={`Filter "${tag.name}" entfernen`}
							>
								{tag.name}
								<IconX size={12} stroke="2.5" aria-hidden="true" />
							</button>
						</li>
					)}
				</For>
			</ul>
		</Show>
	)
}

export default TagFilter
