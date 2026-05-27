import type { Component, JSX } from 'solid-js'
import msLogo from '../img/ms-symbollockup_mssymbol_19.svg'
import '../css/microsoft-login.scss'

type Props = {
	localLoginForm: JSX.Element
}

const MicrosoftLoginSection: Component<Props> = (props) => {
	return (
		<div class="microsoft-login-section">
			<a href="/api/auth/login/microsoft" class="login-button-microsoft">
				<span class="ms-logo" aria-hidden="true">
					<img src={msLogo} alt="Microsoft logo" />
				</span>
				<span class="ms-text">Sign in with Microsoft</span>
			</a>
			<details class="local-login-details">
				<summary>Use local account</summary>
				{props.localLoginForm}
			</details>
		</div>
	)
}

export default MicrosoftLoginSection
