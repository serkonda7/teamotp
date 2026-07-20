import { IconSearch } from '@tabler/icons-solidjs'
import type { InputEventAndTarget } from 'shared/src/types'
import { createSignal, type JSX, onCleanup, onMount } from 'solid-js'

type SearchInputProps = {
	value: string
	onInput: (value: string) => void
	placeholder: string
	ariaLabel: string
}

const SearchInput = (props: SearchInputProps): JSX.Element => {
	const [isFocused, setIsFocused] = createSignal(false)
	let inputRef: HTMLInputElement | undefined

	onMount(() => {
		const handleKeyDown = (event: KeyboardEvent): void => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault()

				const activeElement = document.activeElement
				if (
					activeElement instanceof HTMLInputElement ||
					activeElement instanceof HTMLTextAreaElement
				) {
					return
				}

				inputRef?.focus()
			}
		}

		window.addEventListener('keydown', handleKeyDown)

		onCleanup(() => {
			window.removeEventListener('keydown', handleKeyDown)
		})
	})

	return (
		<div class="search-input">
			<IconSearch class="search-input__icon" size={16} stroke="2" aria-hidden="true" />
			<input
				ref={inputRef}
				class="search-input__field"
				type="search"
				value={props.value}
				onInput={(event: InputEventAndTarget): void => {
					props.onInput(event.currentTarget.value)
				}}
				onFocus={() => {
					setIsFocused(true)
					inputRef?.select()
				}}
				onBlur={() => setIsFocused(false)}
				placeholder={props.placeholder}
				aria-label={props.ariaLabel}
				autofocus
			/>
			<kbd
				class="search-input__shortcut"
				classList={{
					'search-input__shortcut--hidden': props.value.length > 0 && isFocused(),
				}}
			>
				Strg K
			</kbd>
		</div>
	)
}

export default SearchInput
