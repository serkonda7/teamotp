import { useNavigate, useSearch } from '@tanstack/solid-router'
import { Result } from 'better-result'
import type { JSX } from 'solid-js'
import { createSignal, onMount, Show } from 'solid-js'
import { login } from '../../api_auth'
import { providers_query, use_query } from '../../queries'
import type { AppSearch } from '../../router'
import type { InputEventAndTarget } from '../../types'
import TeamOtpLogo from '../TeamOtpLogo'
import MicrosoftSignInSection from './MicrosoftSignInSection'

type Props = {
	onLoginSuccess: () => void
	/** Set when the previous session timed out, to explain why the login page is shown again. */
	sessionExpired: boolean
}

/** Translates the `?error=` param set by the OAuth callback redirect. */
function oauthErrorMessage(code: string | undefined): string | null {
	if (code !== 'invalid_state' && code !== 'expired_state') {
		return null
	}
	return 'Anmeldung abgelaufen.' // Show simple generic error to avoid info overload
}

const LoginPage = (props: Props): JSX.Element => {
	const [email, setEmail] = createSignal('')
	const [password, setPassword] = createSignal('')
	const [error, setError] = createSignal<string | null>(null)
	const [isSubmitting, setIsSubmitting] = createSignal(false)

	const navigate = useNavigate()
	const search = useSearch({ from: '__root__' })
	const oauthError = oauthErrorMessage(search().error)

	const providers = use_query(providers_query)

	onMount(() => {
		if (oauthError) {
			void navigate({
				to: '.',
				search: (prev: AppSearch) => ({ ...prev, error: undefined }),
				replace: true,
			})
		}
	})

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

	const hasMicrosoftProvider = (): boolean => providers.data()?.microsoft === true
	const hasLocalProvider = (): boolean => providers.data()?.local === true
	const isProvidersKnown = (): boolean => providers.data() != null

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
				<Show when={oauthError}>
					<div class="login-error">{oauthError}</div>
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
