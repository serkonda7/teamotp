import { ColorInput } from '@serkonda7/solid-components'
import { type JSX, onMount } from 'solid-js'

type TagColorInputProps = {
	id: string
	value: string
	onInput: (color: string) => void
	disabled?: boolean
	tabindex?: number
}

const TagColorInput = (props: TagColorInputProps): JSX.Element => {
	let wrapper: HTMLDivElement | undefined

	onMount(() => {
		// ColorInput does not expose an id or tabindex, so attach them to its inputs.
		const text = wrapper?.querySelector<HTMLInputElement>('.color-input-text')
		if (text) {
			text.id = props.id
		}
		const tabindex = props.tabindex
		if (tabindex !== undefined) {
			wrapper?.querySelectorAll('input').forEach((input) => {
				input.tabIndex = tabindex
			})
		}
	})

	return (
		<div ref={wrapper} class="tag-color-input">
			<ColorInput
				value={props.value}
				onInput={props.onInput}
				disabled={props.disabled}
				ariaLabel="Farbe"
				pickerLabel="Farbe auswählen"
			/>
		</div>
	)
}

export default TagColorInput
