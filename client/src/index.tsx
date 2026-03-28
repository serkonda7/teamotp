import { render } from 'solid-js/web'

import App from './App'

const root = document.getElementById('root')

// biome-ignore lint/style/noNonNullAssertion: we know it exists
render(() => <App />, root!)
