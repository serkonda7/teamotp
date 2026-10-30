import { Outlet, useLocation, useNavigate, useSearch } from '@tanstack/solid-router'
import type { TagInfo } from 'shared/src/types'
import {
	type Accessor,
	createContext,
	createEffect,
	createMemo,
	createSignal,
	type JSX,
	Show,
	untrack,
	useContext,
} from 'solid-js'
import { tags_query, use_query } from '../queries'
import type { AppSearch } from '../router'
import AppFooter from './AppFooter'
import AppHeader from './AppHeader'
import TagFilter, { TagFilterPills } from './TagFilter'

type MainViewState = {
	searchQuery: Accessor<string>
	tagSearchQuery: Accessor<string>
	activeTagIds: Accessor<string[]>
	showEntryTags: Accessor<boolean>
	tagsError: Accessor<string | null>
}

const MainViewContext = createContext<MainViewState>({
	searchQuery: () => '',
	tagSearchQuery: () => '',
	activeTagIds: () => [],
	showEntryTags: () => true,
	tagsError: () => null,
})

/** The state of the header that the pages below it depend on. */
export function useMainView(): MainViewState {
	return useContext(MainViewContext)
}

/**
 * Header and footer around the current page. Mounted only while logged in, so
 * nothing held here survives into the next session.
 */
const MainView = (props: { onLogout: () => void }): JSX.Element => {
	const navigate = useNavigate()
	const location = useLocation()
	const isTagsPage = (): boolean => location().pathname === '/tags'
	const search = useSearch({ from: '__root__' })

	const tags = use_query(tags_query)
	const sortedTags = createMemo<TagInfo[]>(() =>
		[...(tags.data() ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
	)

	// The input needs the raw text, the URL only follows it: while typing it would
	// lag behind, and its trimmed value would swallow every space.
	const [searchQuery, setSearchQuery] = createSignal(untrack(search).search ?? '')
	const [tagSearchQuery, setTagSearchQuery] = createSignal('')
	const [activeTagIds, setActiveTagIds] = createSignal<string[]>([])
	const [showEntryTags, setShowEntryTags] = createSignal(true)

	createEffect(() => {
		const query = searchQuery().trim() || undefined
		if (query !== untrack(search).search) {
			void navigate({
				to: '.',
				search: (prev: AppSearch) => ({ ...prev, search: query }),
				replace: true,
			})
		}
	})

	// Deselect tags that no longer exist (e.g. deleted on the tags page)
	createEffect(() => {
		const existingIds = new Set(sortedTags().map((tag) => tag.id))
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

	return (
		<MainViewContext.Provider
			value={{
				searchQuery,
				tagSearchQuery,
				activeTagIds,
				showEntryTags,
				tagsError: tags.error,
			}}
		>
			<div>
				<AppHeader
					isTagsPage={isTagsPage()}
					onLogout={props.onLogout}
					searchQuery={searchQuery()}
					onSearchInput={setSearchQuery}
					tagSearchQuery={tagSearchQuery()}
					onTagSearchInput={setTagSearchQuery}
					tagPills={
						<Show when={!isTagsPage()}>
							<TagFilterPills
								tags={sortedTags()}
								activeTagIds={activeTagIds()}
								onToggle={toggleTagFilter}
								onClear={() => setActiveTagIds([])}
							/>
						</Show>
					}
				>
					<Show when={!isTagsPage() && sortedTags().length > 0}>
						<TagFilter
							tags={sortedTags()}
							activeTagIds={activeTagIds()}
							onToggle={toggleTagFilter}
							showEntryTags={showEntryTags()}
							onToggleEntryTags={() => setShowEntryTags((visible) => !visible)}
						/>
					</Show>
				</AppHeader>
				<Outlet />
				<AppFooter />
			</div>
		</MainViewContext.Provider>
	)
}

export default MainView
