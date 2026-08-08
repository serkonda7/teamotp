/**
 * Client side mirror of the server session idle timeout.
 *
 * The server already rejects requests of a timed out session, but only when one
 * is made. Without this the vault list stays on screen indefinitely after the
 * user walked away, and they only learn about the timeout on the next click.
 */
import { SESSION_IDLE_TIMEOUT_S } from 'shared/src/session'

/** User interactions that count as activity, matching what causes API requests. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'focus'] as const

/** How often the elapsed idle time is checked. */
const CHECK_INTERVAL_MS = 60 * 1000

/**
 * Calls `on_timeout` once the user has been inactive for the session idle timeout.
 * Returns a function that stops the timer and removes all listeners.
 *
 * Compares timestamps instead of using a single long timer, because a timer does
 * not run while the device is suspended and would fire far too late.
 */
export function start_idle_timer(on_timeout: () => void): () => void {
	let last_activity = Date.now()
	let stopped = false

	function on_activity(): void {
		last_activity = Date.now()
	}

	const interval = setInterval(() => {
		if (Date.now() - last_activity < SESSION_IDLE_TIMEOUT_S * 1000) {
			return
		}

		stop()
		on_timeout()
	}, CHECK_INTERVAL_MS)

	for (const event of ACTIVITY_EVENTS) {
		window.addEventListener(event, on_activity, { passive: true })
	}

	function stop(): void {
		if (stopped) {
			return
		}
		stopped = true

		clearInterval(interval)
		for (const event of ACTIVITY_EVENTS) {
			window.removeEventListener(event, on_activity)
		}
	}

	return stop
}
