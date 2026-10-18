import { IconCheck } from '@tabler/icons-solidjs'
import { type JSX, Show } from 'solid-js'

type Props = {
	selected: boolean
}

/** Check mark shown inside a tag chip (`tag-chip--selected`) while the tag is selected. */
const TagSelectMark = (props: Props): JSX.Element => (
	<Show when={props.selected}>
		<IconCheck size={12} stroke="3" aria-hidden="true" />
	</Show>
)

export default TagSelectMark
