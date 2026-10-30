import type { OtpDisplayInfo } from 'shared/src/types'
import { createMemo, createSignal, type JSX, Show } from 'solid-js'
import { otps_query, use_query } from '../queries'
import { otpMatchesSearch, otpMatchesTags } from '../util/otp_search'
import AddFromOtpauthForm from './AddFromOtpauthForm'
import { useMainView } from './MainView'
import OtpList from './OtpList'

const OtpPage = (): JSX.Element => {
	const { searchQuery, activeTagIds, showEntryTags, tagsError } = useMainView()

	const otps = use_query(otps_query)
	const [error, setError] = createSignal<string | null>(null)
	const [focusedEntryId, setFocusedEntryId] = createSignal<string | null>(null)

	const filteredOtps = createMemo<OtpDisplayInfo[]>(() => {
		const query = searchQuery()
		const tagIds = activeTagIds()
		return (otps.data() ?? []).filter(
			(otp) => otpMatchesSearch(otp, query) && otpMatchesTags(otp, tagIds),
		)
	})

	const shownError = (): string | null => error() ?? otps.error() ?? tagsError()

	return (
		<>
			<AddFromOtpauthForm setError={setError} onCreated={setFocusedEntryId} />

			<Show when={shownError()}>
				<div class="app-inline-error">{shownError()}</div>
			</Show>

			<OtpList
				otps={filteredOtps()}
				loading={otps.isPending()}
				searchQuery={searchQuery()}
				tagFilterActive={activeTagIds().length > 0}
				showEntryTags={showEntryTags()}
				setError={setError}
				focusedId={focusedEntryId}
				onFocused={() => setFocusedEntryId(null)}
			/>
		</>
	)
}

export default OtpPage
