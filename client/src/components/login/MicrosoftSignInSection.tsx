import type { JSX } from 'solid-js'
import { onMount, Show } from 'solid-js'
import msLogo from '../../img/ms-symbollockup_mssymbol_19.svg'
import '../../css/microsoft-login.css'

type Props = {
	localLoginForm: JSX.Element
	showLocal: boolean
}

const MicrosoftSignInSection = (props: Props): JSX.Element => {
	let btnRef: HTMLAnchorElement | undefined

	onMount(() => {
		btnRef?.focus()
	})

	return (
		<div class="microsoft-login-section">
			<a
				ref={(el: HTMLAnchorElement) => {
					btnRef = el
				}}
				href="/api/auth/login/microsoft"
				class="login-button-microsoft"
				autofocus
			>
				<span class="ms-logo" aria-hidden="true">
					<img src={msLogo} alt="Microsoft-Logo" />
				</span>
				<span class="ms-text">Mit Microsoft anmelden</span>
			</a>
			<Show when={props.showLocal}>
				<details class="local-login-details">
					<summary>Lokales Konto verwenden</summary>
					{props.localLoginForm}
				</details>
			</Show>
		</div>
	)
}

export default MicrosoftSignInSection
