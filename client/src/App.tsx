import { Result } from 'better-result'
import type { OtpDisplayInfo, TagInfo } from 'shared/src/types'
import {
	createEffect,
	createMemo,
	createResource,
	createSignal,
	type JSX,
	onMount,
	Show,
} from 'solid-js'
import { client, fetch_tags } from './api'
import AboutDialog from './components/AboutDialog'
import AddFromOtpauthForm from './components/AddFromOtpauthForm'
import AppHeader from './components/AppHeader'
import LoginPage from './components/login/LoginPage'
import OtpList from './components/OtpList'
import TagFilterBar from './components/TagFilterBar'
import TagsPage from './components/TagsPage'
import { navigate, path, setTagsChanged, tagsChanged } from './router'
import { otpMatchesSearch, otpMatchesTags } from './util/otp_search'
import { makeArrayRefetch } from './util/resource_helpers'

function App(): JSX.Element {
	const [isLoggedIn, setIsLoggedIn] = createSignal<boolean | null>(null)

	const [otps, { refetch }] = createResource(
		isLoggedIn,
		async (loggedIn) => {
			if (!loggedIn) {
				return []
			}
			return await fetchOtps()
		},
		{ initialValue: [] },
	)
	const refetchTyped = makeArrayRefetch<OtpDisplayInfo>(refetch)

	const [otpauthUrl, setOtpauthUrl] = createSignal('')
	const [submitting, setSubmitting] = createSignal(false)
	const [error, setError] = createSignal<string | null>(null)
	const [aboutOpen, setAboutOpen] = createSignal(false)
	const initialSearchQuery =
		typeof window !== 'undefined'
			? (new URLSearchParams(window.location.search).get('search') ?? '')
			: ''
	const [searchQuery, setSearchQuery] = createSignal(initialSearchQuery)
	const [tagSearchQuery, setTagSearchQuery] = createSignal('')
	const [activeTagIds, setActiveTagIds] = createSignal<string[]>([])

	const [allTags, { refetch: refetchTags }] = createResource(
		isLoggedIn,
		async (loggedIn): Promise<TagInfo[]> => {
			if (!loggedIn) {
				return []
			}
			const res = await fetch_tags()
			if (Result.isError(res)) {
				setError(res.error.message)
				return []
			}
			return res.value.sort((a, b) => a.name.localeCompare(b.name))
		},
		{ initialValue: [] },
	)

	const filteredOtps = createMemo<OtpDisplayInfo[]>(() => {
		const query = searchQuery()
		const tagIds = activeTagIds()
		return otps().filter((otp) => otpMatchesSearch(otp, query) && otpMatchesTags(otp, tagIds))
	})

	// Deselect tags that no longer exist (e.g. deleted on the tags page)
	createEffect(() => {
		const existingIds = new Set(allTags().map((tag) => tag.id))
		const pruned = activeTagIds().filter((id) => existingIds.has(id))
		if (pruned.length !== activeTagIds().length) {
			setActiveTagIds(pruned)
		}
	})

	function toggleTagFilter(tagId: string): void {
		setActiveTagIds((prev) =>
			prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
		)
	}

	createEffect(() => {
		if (typeof window === 'undefined') {
			return
		}

		if (path() !== '/tags' && tagsChanged()) {
			setTagsChanged(false)
			void refetchTyped()
			void refetchTags()
		}

		const url = new URL(window.location.href)
		const query = searchQuery().trim()

		if (query.length > 0) {
			url.searchParams.set('search', query)
		} else {
			url.searchParams.delete('search')
		}

		const next = `${url.pathname}${url.search}${url.hash}`
		const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
		if (next !== current) {
			window.history.replaceState(null, '', next)
		}
	})

	onMount(async () => {
		try {
			const res = await fetch('/api/auth/me')
			setIsLoggedIn(res.ok)
		} catch {
			setIsLoggedIn(false)
		}
	})

	async function fetchOtps(): Promise<OtpDisplayInfo[]> {
		const res = await client.otp.$get()
		if (res.status === 401) {
			setIsLoggedIn(false)
			return []
		}
		const data = await res.json()
		return data as OtpDisplayInfo[]
	}

	async function handleLogout(): Promise<void> {
		try {
			await fetch('/api/auth/logout', { method: 'POST' })
			setIsLoggedIn(false)
			setSearchQuery('')
			setTagSearchQuery('')
			setActiveTagIds([])
			navigate('/')
		} catch (err) {
			console.error('Logout failed', err)
		}
	}

	return (
		<Show when={isLoggedIn() !== null} fallback={<div>Laden...</div>}>
			<Show
				when={isLoggedIn()}
				fallback={<LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />}
			>
				<div>
					<AppHeader
						onOpenAbout={() => setAboutOpen(true)}
						onLogout={handleLogout}
						searchQuery={searchQuery()}
						onSearchInput={setSearchQuery}
						tagSearchQuery={tagSearchQuery()}
						onTagSearchInput={setTagSearchQuery}
					/>
					<AboutDialog open={aboutOpen()} onClose={() => setAboutOpen(false)} />

					<Show
						when={path() === '/tags'}
						fallback={
							<>
								<AddFromOtpauthForm
									otpauthUrl={otpauthUrl}
									setOtpauthUrl={setOtpauthUrl}
									submitting={submitting}
									setSubmitting={setSubmitting}
									setError={setError}
									refetch={refetchTyped}
								/>

								<Show when={error()}>
									<div class="app-inline-error">{error()}</div>
								</Show>

								<Show when={allTags().length > 0}>
									<TagFilterBar
										tags={allTags()}
										activeTagIds={activeTagIds()}
										onToggle={toggleTagFilter}
									/>
								</Show>

								<OtpList
									otps={filteredOtps()}
									loading={otps.loading}
									searchQuery={searchQuery()}
									tagFilterActive={activeTagIds().length > 0}
									setError={setError}
									refetch={refetchTyped}
								/>
							</>
						}
					>
						<TagsPage searchQuery={tagSearchQuery()} />
					</Show>
				</div>
			</Show>
		</Show>
	)
}

export default App
