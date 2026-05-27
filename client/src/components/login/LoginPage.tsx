import type { Component } from 'solid-js'
import { createResource, createSignal, Show } from 'solid-js'
import MicrosoftSignInButton from './MicrosoftSignInButton'

type Props = {
	onLoginSuccess: () => void
}

type Providers = { local: boolean; microsoft: boolean }

async function fetchProviders(): Promise<Providers> {
	const res = await fetch('/api/auth/providers')
	if (!res.ok) {
		return { local: true, microsoft: false }
	}
	return res.json() as Promise<Providers>
}

const LoginPage: Component<Props> = (props) => {
	const [email, setEmail] = createSignal('')
	const [password, setPassword] = createSignal('')
	const [error, setError] = createSignal<string | null>(null)
	const [isSubmitting, setIsSubmitting] = createSignal(false)

	const [providers] = createResource(fetchProviders, {
		initialValue: { local: true, microsoft: false },
	})

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault()
		setError(null)

		if (!email() || !password()) {
			setError('Please enter both email and password.')
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
				const data = await res.json().catch(() => null)
				setError(data?.error || 'Login failed.')
				return
			}

			// Call success callback to update App state
			props.onLoginSuccess()
		} catch (_err) {
			setError('A network error occurred. Please try again.')
		} finally {
			setIsSubmitting(false)
		}
	}

	const hasMicrosoftProvider = () => providers()?.microsoft

	const localLoginForm = () => (
		<form onSubmit={handleSubmit} class="login-form">
			<div class="form-group">
				<label for="email">Email</label>
				<input
					type="email"
					id="email"
					value={email()}
					onInput={(e) => setEmail(e.currentTarget.value)}
					disabled={isSubmitting()}
					required
					autofocus={!hasMicrosoftProvider()}
				/>
			</div>
			<div class="form-group">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					value={password()}
					onInput={(e) => setPassword(e.currentTarget.value)}
					disabled={isSubmitting()}
					required
				/>
			</div>
			<Show when={error()}>
				<div class="login-error">{error()}</div>
			</Show>
			<button type="submit" disabled={isSubmitting()} class="login-button">
				{isSubmitting() ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
	)

	return (
		<div class="login-container">
			<div class="login-card">
				<h1 class="login-title">TeamOTP</h1>
				<Show when={hasMicrosoftProvider()} fallback={localLoginForm()}>
					<MicrosoftSignInButton localLoginForm={localLoginForm()} />
				</Show>
			</div>
		</div>
	)
}

export default LoginPage
