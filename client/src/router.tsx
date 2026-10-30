/** Routes of the app. The login gate lives in `App`, so it covers every route. */
import { createRootRoute, createRoute, createRouter, Navigate } from '@tanstack/solid-router'
import type { JSX } from 'solid-js'
import App from './App'
import OtpPage from './components/OtpPage'
import TagsPage from './components/TagsPage'

export type AppSearch = {
	/** Entry search, kept in the URL so it can be shared and survives a reload. */
	search?: string
	/** Set by the OAuth callback redirect. */
	error?: string
}

const rootRoute = createRootRoute({
	component: App,
	// Params missing here are stripped from the URL when the router starts
	validateSearch: (search: Record<string, unknown>): AppSearch => ({
		search: search.search === undefined ? undefined : String(search.search),
		error: search.error === undefined ? undefined : String(search.error),
	}),
	notFoundComponent: (): JSX.Element => <Navigate to="/" search={true} replace={true} />,
})

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/',
	component: OtpPage,
})

const tagsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: '/tags',
	component: TagsPage,
})

export const router = createRouter({
	routeTree: rootRoute.addChildren([indexRoute, tagsRoute]),
})

declare module '@tanstack/solid-router' {
	interface Register {
		router: typeof router
	}
}
