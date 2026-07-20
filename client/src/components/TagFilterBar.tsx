import type { TagInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { For } from 'solid-js'

type Props = {
	tags: TagInfo[]
	activeTagIds: string[]
	onToggle: (tagId: string) => void
}

const TagFilterBar = (props: Props): JSX.Element => (
	<div class="tag-filter-bar">
		<For each={props.tags}>
			{(tag: TagInfo): JSX.Element => {
				const isActive = (): boolean => props.activeTagIds.includes(tag.id)
				return (
					<button
						type="button"
						class="tag-chip tag-filter-bar__chip"
						classList={{ 'tag-filter-bar__chip--active': isActive() }}
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
)

export default TagFilterBar
