import { IconFilter2, IconFilter2Cancel } from '@tabler/icons-solidjs'
import type { TagInfo } from 'shared/src/types'
import { createEffect, createMemo, createSignal, For, type JSX, onCleanup, Show } from 'solid-js'

type Props = {
	tags: TagInfo[]
	activeTagIds: string[]
	onToggle: (tagId: string) => void
	onClear: () => void
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
			classList={{ 'tag-filter__chip--active': isActive() }}
			style={{ '--tag-color': props.tag.color }}
			onClick={(): void => props.onToggle(props.tag.id)}
			aria-pressed={isActive()}
			title={`Nach Tag "${props.tag.name}" filtern`}
		>
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
	onClear: () => void
}

const TagFilterPopover = (props: TagFilterPopoverProps): JSX.Element => (
	<div class="tag-filter__popover">
		<button
			type="button"
			class="tag-filter__clear"
			onClick={props.onClear}
			disabled={props.activeTagIds.length === 0}
			title="Tag-Filter zurücksetzen"
		>
			<IconFilter2Cancel size={16} stroke="2" aria-hidden="true" />
			Zurücksetzen
		</button>
		<div class="tag-filter__chips">
			<For each={props.tags}>
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
					onClear={props.onClear}
				/>
			</Show>
		</div>
	)
}

export default TagFilter
