import { Show } from 'solid-js'

type AboutDialogProps = {
	open: boolean
	onClose: () => void
}

function AboutDialog(props: AboutDialogProps) {
	return (
		<Show when={props.open}>
			<div class="modal-backdrop" role="presentation">
				<button
					type="button"
					class="modal-dismiss"
					aria-label="Close about dialog"
					onClick={props.onClose}
				/>
				<div class="modal-card" role="dialog" aria-modal="true" aria-label="About TeamOTP">
					<h2>About TeamOTP</h2>
					<p>Version 0.0.1</p>
					<a href="https://github.com/serkonda7/teamotp" target="_blank" rel="noreferrer">
						github.com/serkonda7/teamotp
					</a>
					<div class="modal-actions">
						<button type="button" onClick={props.onClose}>
							Close
						</button>
					</div>
				</div>
			</div>
		</Show>
	)
}

export default AboutDialog
