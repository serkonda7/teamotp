import { IconBrandGithub, IconX } from '@tabler/icons-solidjs'
import { type JSX, onCleanup, onMount, Show } from 'solid-js'
import TeamOtpLogo from './TeamOtpLogo'

type AboutDialogProps = {
	open: boolean
	onClose: () => void
}

const VersionLine = (): JSX.Element => (
	<p>
		Version 0.4.0 (
		<a
			href="https://github.com/serkonda7/teamotp/blob/main/CHANGELOG.md#040"
			target="_blank"
			rel="noreferrer"
		>
			Änderungen
		</a>
		)
	</p>
)

const SourceLink = (): JSX.Element => (
	<a
		href="https://github.com/serkonda7/teamotp"
		target="_blank"
		rel="noreferrer"
		class="github-link"
	>
		<IconBrandGithub size={18} stroke="2" aria-hidden="true" />
		Quellcode
	</a>
)

function AboutDialogContent(props: AboutDialogProps): JSX.Element {
	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			props.onClose()
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeyDown)
		onCleanup(() => {
			document.removeEventListener('keydown', handleKeyDown)
		})
	})

	return (
		<div class="modal-backdrop" role="presentation">
			<button
				type="button"
				class="modal-dismiss"
				aria-label="Über TeamOTP schließen"
				onClick={props.onClose}
			/>
			<div class="modal-card" role="dialog" aria-modal="true" aria-label="TeamOTP">
				<button
					type="button"
					class="icon-button modal-close"
					aria-label="Über TeamOTP schließen"
					onClick={props.onClose}
				>
					<IconX size={18} stroke="2" aria-hidden="true" />
				</button>
				<h2>
					<TeamOtpLogo />
				</h2>
				<VersionLine />
				<SourceLink />
			</div>
		</div>
	)
}

const AboutDialog = (props: AboutDialogProps): JSX.Element => (
	<Show when={props.open}>
		<AboutDialogContent {...props} />
	</Show>
)

export default AboutDialog
