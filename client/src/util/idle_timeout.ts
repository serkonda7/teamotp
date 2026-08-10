/**
 * Client side mirror of the server session idle timeout.
 *
 * The server already rejects requests of a timed out session, but only when one
 * is made. Without this the vault list stays on screen indefinitely after the
 * user walked away, and they only learn about the timeout on the next click.
 */
import { SESSION_IDLE_TIMEOUT_S } from 'shared/src/session'

/** How often the elapsed idle time is checked. */
const CHECK_INTERVAL_MS = 60 * 1000

/** When the server last confirmed the session, mirroring its `last_seen_at`. */
let last_server_activity = Date.now()

/**
 * Restarts the idle window, to be called whenever the server answered an
 * authenticated request and therefore refreshed the session on its side.
 *
 * Only requests count. Interaction that stays in the browser, like scrolling or
 * filtering the list, never renews the server session, so treating it as
 * activity would keep the codes on screen after the session is already gone.
 */
export function note_server_activity(): void {
	last_server_activity = Date.now()
}

/**
 * Calls `on_timeout` once the server session has not been renewed for the idle
 * timeout. Returns a function that stops the timer.
 *
 * Compares timestamps instead of using a single long timer, because a timer does
 * not run while the device is suspended and would fire far too late.
 */
export function start_idle_timer(on_timeout: () => void): () => void {
	// Starting implies a just confirmed session, either a login or the `/me` check
	note_server_activity()
	let stopped = false

	const interval = setInterval(() => {
		if (Date.now() - last_server_activity < SESSION_IDLE_TIMEOUT_S * 1000) {
			return
		}

		stop()
		on_timeout()
	}, CHECK_INTERVAL_MS)

	function stop(): void {
		if (stopped) {
			return
		}
		stopped = true

		clearInterval(interval)
	}

	return stop
}
