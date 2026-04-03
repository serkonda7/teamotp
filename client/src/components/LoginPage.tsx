import type { Component } from 'solid-js'
import { createSignal, Show } from 'solid-js'

type Props = {
	onLoginSuccess: () => void
}

const LoginPage: Component<Props> = (props) => {
	const [email, setEmail] = createSignal('')
	const [password, setPassword] = createSignal('')
	const [error, setError] = createSignal<string | null>(null)
	const [isSubmitting, setIsSubmitting] = createSignal(false)

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

	return (
		<div class="login-container">
			<div class="login-card">
				<h1 class="login-title">TeamOTP</h1>
				<form onSubmit={handleSubmit} class="login-form">
					<div class="form-group">
						<label for="email">Email</label>
						<input
							type="email"
							id="email"
							placeholder="admin@example.com"
							value={email()}
							onInput={(e) => setEmail(e.currentTarget.value)}
							disabled={isSubmitting()}
							required
						/>
					</div>
					<div class="form-group">
						<label for="password">Password</label>
						<input
							type="password"
							id="password"
							placeholder="••••••••"
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
			</div>
		</div>
	)
}

export default LoginPage
