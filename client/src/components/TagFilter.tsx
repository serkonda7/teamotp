import { IconFilter2, IconFilter2Cancel } from '@tabler/icons-solidjs'
import type { TagInfo } from 'shared/src/types'
import { createEffect, createSignal, For, type JSX, onCleanup, Show } from 'solid-js'

type Props = {
	tags: TagInfo[]
	activeTagIds: string[]
	onToggle: (tagId: string) => void
	onClear: () => void
}

const TagFilter = (props: Props): JSX.Element => {
	const [open, setOpen] = createSignal(false)
	let rootRef: HTMLDivElement | undefined
	let buttonRef: HTMLButtonElement | undefined

	// Close the popover on outside click or Escape
	createEffect(() => {
		if (!open()) {
			return
		}

		const handlePointerDown = (event: PointerEvent): void => {
			if (rootRef && !rootRef.contains(event.target as Node)) {
				setOpen(false)
			}
		}
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				setOpen(false)
				buttonRef?.focus()
			}
		}

		document.addEventListener('pointerdown', handlePointerDown)
		document.addEventListener('keydown', handleKeyDown)
		onCleanup(() => {
			document.removeEventListener('pointerdown', handlePointerDown)
			document.removeEventListener('keydown', handleKeyDown)
		})
	})

	return (
		<div class="tag-filter" ref={rootRef}>
			<button
				type="button"
				ref={buttonRef}
				class="icon-button tag-filter__button"
				tabindex={4}
				classList={{ 'tag-filter__button--active': props.activeTagIds.length > 0 }}
				onClick={(): void => {
					setOpen((prev) => !prev)
				}}
				aria-label="Nach Tags filtern"
				aria-expanded={open()}
				title="Nach Tags filtern"
			>
				<IconFilter2 size={18} stroke="2" aria-hidden="true" />
				<Show when={props.activeTagIds.length > 0}>
					<span class="tag-filter__badge">{props.activeTagIds.length}</span>
				</Show>
			</button>
			<Show when={open()}>
				<div class="tag-filter__popover">
					<Show when={props.activeTagIds.length > 0}>
						<button
							type="button"
							class="tag-filter__clear"
							tabindex={4}
							onClick={(): void => props.onClear()}
							title="Tag-Filter zurücksetzen"
						>
							<IconFilter2Cancel size={16} stroke="2" aria-hidden="true" />
							Filter zurücksetzen
						</button>
					</Show>
					<div class="tag-filter__chips">
						<For each={props.tags}>
							{(tag: TagInfo): JSX.Element => {
								const isActive = (): boolean => props.activeTagIds.includes(tag.id)
								return (
									<button
										type="button"
										class="tag-chip tag-filter__chip"
										tabindex={4}
										classList={{ 'tag-filter__chip--active': isActive() }}
										style={{ '--tag-color': tag.color }}
										onClick={(): void => props.onToggle(tag.id)}
										aria-pressed={isActive()}
										title={`Nach Tag "${tag.name}" filtern`}
									>
										{tag.name}
									</button>
								)
							}}
						</For>
					</div>
				</div>
			</Show>
		</div>
	)
}

export default TagFilter
