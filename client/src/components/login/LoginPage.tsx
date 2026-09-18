import { Result } from 'better-result'
import type { InputEventAndTarget } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createResource, createSignal, Show } from 'solid-js'
import { type AuthProviders, fetchProviders, login } from '../../api_auth'
import TeamOtpLogo from '../TeamOtpLogo'
import MicrosoftSignInSection from './MicrosoftSignInSection'

type Props = {
	onLoginSuccess: () => void
	/** Set when the previous session timed out, to explain why the login page is shown again. */
	sessionExpired: boolean
}

const LoginPage = (props: Props): JSX.Element => {
	const [email, setEmail] = createSignal('')
	const [password, setPassword] = createSignal('')
	const [error, setError] = createSignal<string | null>(null)
	const [isSubmitting, setIsSubmitting] = createSignal(false)

	const [oauthError] = createSignal<string | null>(
		(() => {
			if (typeof window === 'undefined') {
				return null
			}
			const params = new URLSearchParams(window.location.search)
			const code = params.get('error')
			if (code !== 'invalid_state' && code !== 'expired_state') {
				return null
			}
			params.delete('error')
			history.replaceState(
				null,
				'',
				`${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`,
			)
			return 'Anmeldung abgelaufen.' // Show simple generic error to avoid info overload
		})(),
	)

	const [providers] = createResource<AuthProviders | undefined>(fetchProviders)

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault()
		setError(null)

		if (!email() || !password()) {
			setError('Bitte E-Mail und Passwort eingeben.')
			return
		}

		setIsSubmitting(true)

		try {
			const login_res = await login(email(), password())
			if (Result.isError(login_res)) {
				setError(login_res.error.message)
				return
			}

			// Call success callback to update App state
			props.onLoginSuccess()
		} finally {
			setIsSubmitting(false)
		}
	}

	const hasMicrosoftProvider = (): boolean => providers()?.microsoft === true
	const hasLocalProvider = (): boolean => providers()?.local === true
	const isProvidersKnown = (): boolean => providers() !== undefined

	const localLoginForm = (): JSX.Element => (
		<form onSubmit={handleSubmit} class="login-form">
			<div class="form-group">
				<label for="email">E-Mail</label>
				<input
					type="email"
					id="email"
					value={email()}
					onInput={(e: InputEventAndTarget): string => setEmail(e.currentTarget.value)}
					disabled={isSubmitting()}
					required
					autofocus={!hasMicrosoftProvider()}
				/>
			</div>
			<div class="form-group">
				<label for="password">Passwort</label>
				<input
					type="password"
					id="password"
					value={password()}
					onInput={(e: InputEventAndTarget): string => setPassword(e.currentTarget.value)}
					disabled={isSubmitting()}
					required
				/>
			</div>
			<Show when={error()}>
				<div class="login-error">{error()}</div>
			</Show>
			<button type="submit" disabled={isSubmitting()} class="login-button">
				{isSubmitting() ? 'Anmelden...' : 'Anmelden'}
			</button>
		</form>
	)

	return (
		<div class="login-container">
			<div class="login-card">
				<h1 class="login-title">
					<TeamOtpLogo class="login-title__logo" />
				</h1>
				<Show when={props.sessionExpired}>
					<div class="login-notice">
						Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.
					</div>
				</Show>
				<Show when={oauthError()}>
					<div class="login-error">{oauthError()}</div>
				</Show>
				<Show when={isProvidersKnown() && hasMicrosoftProvider()}>
					<MicrosoftSignInSection
						localLoginForm={localLoginForm()}
						showLocal={hasLocalProvider()}
					/>
				</Show>
				<Show when={isProvidersKnown() && !hasMicrosoftProvider() && hasLocalProvider()}>
					{localLoginForm()}
				</Show>
			</div>
		</div>
	)
}

export default LoginPage
