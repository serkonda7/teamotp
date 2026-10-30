/** Query client and the queries shared between views. */
import { QueryClient, type QueryKey, useQuery } from '@tanstack/solid-query'
import { Result } from 'better-result'
import type { OtpDisplayInfo, TagWithMemberCount } from 'shared/src/types'
import { fetch_otps, fetch_tags } from './api'
import { type AuthProviders, fetchProviders } from './api_auth'

export const query_client = new QueryClient({
	defaultOptions: {
		queries: {
			// Every request restarts the idle window of the session, so data is only
			// ever loaded in response to the user and never in the background.
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: false,
		},
	},
})

/** Query expects a rejected promise on failure, so Results are unwrapped only here. */
async function unwrap<T>(res: Promise<Result<T, Error>>): Promise<T> {
	const result = await res
	if (Result.isError(result)) {
		throw result.error
	}
	return result.value
}

type UseQuery<T> = {
	data: () => T | undefined
	isPending: () => boolean
	error: () => string | null
}

/**
 * `useQuery` without its `data` property. Reading that suspends until the first
 * result, and the Suspense boundary of the router spans the whole app: everything
 * would disappear while loading, and mount detached so focusing fails.
 */
export function use_query<T>(options: {
	queryKey: QueryKey
	queryFn: () => Promise<T>
}): UseQuery<T> {
	const query = useQuery(() => options)
	return {
		data: () => {
			void query.dataUpdatedAt // Track updates, the cache itself is not reactive
			return query_client.getQueryData<T>(options.queryKey)
		},
		isPending: () => query.isPending,
		error: () => query.error?.message ?? null,
	}
}

export const otps_query = {
	queryKey: ['otps'],
	queryFn: (): Promise<OtpDisplayInfo[]> => unwrap(fetch_otps()),
}

export const tags_query = {
	queryKey: ['tags'],
	queryFn: (): Promise<TagWithMemberCount[]> => unwrap(fetch_tags()),
}

export const providers_query = {
	queryKey: ['providers'],
	queryFn: async (): Promise<AuthProviders | null> => (await fetchProviders()) ?? null,
}

/** Reloads everything on screen. Entries and tags reference each other, so any change can affect both. */
export function refresh_data(): Promise<void> {
	return query_client.invalidateQueries()
}
