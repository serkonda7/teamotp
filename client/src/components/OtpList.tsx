import type { OtpDisplayInfo } from 'shared/src/types'
import type { JSX } from 'solid-js'
import { For, Show } from 'solid-js'
import OtpListItem from './OtpListItem'

type Props = {
	otps: OtpDisplayInfo[]
	loading: boolean
	searchQuery: string
	setError: (e: string | null) => void
	refetch: () => Promise<OtpDisplayInfo[]>
}

const OtpList = (props: Props): JSX.Element => (
	<Show when={!props.loading} fallback={<div>Loading...</div>}>
		<Show
			when={props.otps.length > 0}
			fallback={
				<div class="otp-list__empty" role="status" aria-live="polite">
					<Show
						when={props.searchQuery.trim().length > 0}
						fallback={<>No OTP entries yet.</>}
					>
						No entries match "{props.searchQuery.trim()}".
					</Show>
				</div>
			}
		>
			<ul class="otp-list otp-list--grid">
				<For each={props.otps}>
					{(otp: OtpDisplayInfo): JSX.Element => (
						<OtpListItem otp={otp} setError={props.setError} refetch={props.refetch} />
					)}
				</For>
			</ul>
		</Show>
	</Show>
)

export default OtpList
