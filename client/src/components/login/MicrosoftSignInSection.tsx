import type { JSX } from 'solid-js'
import msLogo from '../../img/ms-symbollockup_mssymbol_19.svg'
import '../../css/microsoft-login.css'

type Props = {
	localLoginForm: JSX.Element
}

const MicrosoftSignInSection = (props: Props): JSX.Element => (
	<div class="microsoft-login-section">
		<a href="/api/auth/login/microsoft" class="login-button-microsoft">
			<span class="ms-logo" aria-hidden="true">
				<img src={msLogo} alt="Microsoft-Logo" />
			</span>
			<span class="ms-text">Mit Microsoft anmelden</span>
		</a>
		<details class="local-login-details">
			<summary>Lokales Konto verwenden</summary>
			{props.localLoginForm}
		</details>
	</div>
)

export default MicrosoftSignInSection
