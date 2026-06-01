import { Show } from 'solid-js'
import TeamOtpLogo from './TeamOtpLogo'

type AboutDialogProps = {
	open: boolean
	onClose: () => void
}

const AboutDialog = (props: AboutDialogProps) => (
	<Show when={props.open}>
		<div class="modal-backdrop" role="presentation">
			<button
				type="button"
				class="modal-dismiss"
				aria-label="Close about dialog"
				onClick={props.onClose}
			/>
			<div class="modal-card" role="dialog" aria-modal="true" aria-label="TeamOTP">
				<button
					type="button"
					class="modal-close"
					aria-label="Close about dialog"
					onClick={props.onClose}
				>
					<span aria-hidden="true">X</span>
				</button>
				<h2>
					<TeamOtpLogo />
				</h2>
				<p>Version 0.0.4</p>
				<a href="https://github.com/serkonda7/teamotp" target="_blank" rel="noreferrer">
					Source code on GitHub
				</a>
			</div>
		</div>
	</Show>
)

export default AboutDialog
