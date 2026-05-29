import type { OtpDisplayInfo } from 'shared/src/types'
import type { Component, Resource } from 'solid-js'
import { For, Show } from 'solid-js'
import type { OtpLayoutMode } from '../layout_mode'
import OtpListItem from './OtpListItem'

type Props = {
	otps: Resource<OtpDisplayInfo[]>
	setError: (e: string | null) => void
	setToast: (message: string) => void
	layoutMode?: OtpLayoutMode
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
							setError={props.setError}
							setToast={props.setToast}
						/>
					)}
				</For>
			</ul>
		</Show>
	)
}

export default OtpList
