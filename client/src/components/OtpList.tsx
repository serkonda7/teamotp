import type { OtpDisplayInfo } from 'shared/src/types'
import type { JSX, Resource } from 'solid-js'
import { For, Show } from 'solid-js'
import OtpListItem from './OtpListItem'

type Props = {
	otps: Resource<OtpDisplayInfo[]>
	setError: (e: string | null) => void
	refetch: () => Promise<OtpDisplayInfo[]>
}

const OtpList = (props: Props): JSX.Element => (
	<Show when={!props.otps.loading} fallback={<div>Loading...</div>}>
		<ul class="otp-list otp-list--grid">
			<For each={props.otps()}>
				{(otp: OtpDisplayInfo): JSX.Element => (
					<OtpListItem otp={otp} setError={props.setError} refetch={props.refetch} />
				)}
			</For>
		</ul>
	</Show>
)

export default OtpList
