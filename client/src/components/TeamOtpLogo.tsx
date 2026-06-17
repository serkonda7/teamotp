import type { Component } from 'solid-js'
import teamOtpIcon from '../img/teamotp_icon.svg'

type TeamOtpLogoProps = {
	class?: string
}

const TeamOtpLogo: Component<TeamOtpLogoProps> = (props) => (
	<span class={`teamotp-logo ${props.class ?? ''}`.trim()}>
		<img class="teamotp-logo__icon" src={teamOtpIcon} alt="" aria-hidden="true" />
		<span class="teamotp-logo__text">TeamOTP'</span>
	</span>
)

export default TeamOtpLogo
