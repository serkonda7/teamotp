import { QueryClientProvider } from '@tanstack/solid-query'
import { RouterProvider } from '@tanstack/solid-router'
import { render } from 'solid-js/web'

import './css/styles.css'
import { query_client } from './queries'
import { router } from './router'

const root = document.querySelector('#root')

render(
	() => (
		<QueryClientProvider client={query_client}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	),
	// biome-ignore lint/style/noNonNullAssertion: we know it exists
	root!,
)
