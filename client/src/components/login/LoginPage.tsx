import type { InputEventAndTarget } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { createResource, createSignal, Show } from 'solid-js'
import { read_api_error } from '../../util/api_error'
import TeamOtpLogo from '../TeamOtpLogo'
import MicrosoftSignInSection from './MicrosoftSignInSection'

type Props = {
	onLoginSuccess: () => void
	/** Set when the previous session timed out, to explain why the login page is shown again. */
	sessionExpired: boolean
}

type Providers = { local: boolean; microsoft: boolean }

async function fetchProviders(): Promise<Providers> {
	const res = await fetch('/api/auth/providers')
	if (!res.ok) {
		return { local: true, microsoft: false }
	}
	return res.json() as Promise<Providers>
}

const LoginPage = (props: Props): JSX.Element => {
	const [email, setEmail] = createSignal('')
	const [password, setPassword] = createSignal('')
	const [error, setError] = createSignal<string | null>(null)
	const [isSubmitting, setIsSubmitting] = createSignal(false)

	const [providers] = createResource(fetchProviders, {
		initialValue: { local: true, microsoft: false },
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
			// standard fetch since returning a cookie, not using the hono RPC client for this
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email(), password: password() }),
			})

			if (!res.ok) {
				setError(await read_api_error(res, 'Anmeldung fehlgeschlagen.'))
				return
			}

			// Call success callback to update App state
			props.onLoginSuccess()
		} catch (_err) {
			setError('Ein Netzwerkfehler ist aufgetreten. Bitte erneut versuchen.')
		} finally {
			setIsSubmitting(false)
		}
	}

	const hasMicrosoftProvider = (): boolean => providers()?.microsoft

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
				<Show when={hasMicrosoftProvider()} fallback={localLoginForm()}>
					<MicrosoftSignInSection localLoginForm={localLoginForm()} />
				</Show>
			</div>
		</div>
	)
}

export default LoginPage
