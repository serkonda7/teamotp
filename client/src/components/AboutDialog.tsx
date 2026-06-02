import { IconBrandGithub, IconX } from '@tabler/icons-solidjs'
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
					class="icon-button modal-close"
					aria-label="Close about dialog"
					onClick={props.onClose}
				>
					<IconX size={18} stroke="2" aria-hidden="true" />
				</button>
				<h2>
					<TeamOtpLogo />
				</h2>
				<p>Version 0.0.4</p>
				<a
					href="https://github.com/serkonda7/teamotp"
					target="_blank"
					rel="noreferrer"
					class="github-link"
				>
					<IconBrandGithub size={18} stroke="2" aria-hidden="true" />
					Source code
				</a>
			</div>
		</div>
	</Show>
)

export default AboutDialog
