import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component } from 'solid-js'

type Props = {
	otp: OtpDisplayInfo
	onClick: () => void
}

const OtpListItem: Component<Props> = (props) => {
	const issuerSecond = props.otp.issuer_second.trim()
	const issuerText =
		issuerSecond.length > 0 && issuerSecond !== props.otp.issuer
			? `${props.otp.issuer} (${issuerSecond})`
			: props.otp.issuer

	return (
		<li class="otp-list__item">
			<button type="button" class="otp-list__entry" onClick={props.onClick}>
				<span class="otp-list__text">
					<span class="otp-list__issuer">{issuerText}</span>
					<span class="otp-list__label">{props.otp.label}</span>
				</span>
				<span class="otp-list__code-placeholder" aria-hidden="true">
					&ast; &ast; &ast; &ast; &ast; &ast;
				</span>
			</button>
		</li>
	)
}

export default OtpListItem
