import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component, Resource } from 'solid-js'
import { For, Show } from 'solid-js'
import { showAndCopyOtpCode } from '../showAndCopyOtpCode'
import OtpListItem from './OtpListItem'

type Props = {
	otps: Resource<OtpDisplayInfo[]>
	setError: (e: string | null) => void
	layoutMode?: 'list' | 'grid'
}

const OtpList: Component<Props> = (props) => {
	const layoutMode = () => props.layoutMode ?? 'grid'

	return (
		<Show when={!props.otps.loading} fallback={<div>Loading...</div>}>
			<ul class={`otp-list otp-list--${layoutMode()}`}>
				<For each={props.otps()}>
					{(otp: OtpDisplayInfo) => (
						<OtpListItem
							otp={otp}
							onClick={() => void showAndCopyOtpCode(otp.id, props.setError)}
						/>
					)}
				</For>
			</ul>
		</Show>
	)
}

export default OtpList
