import path from 'node:path'

/**
 * Topology of the app instances Playwright boots for the tests.
 *
 * Microsoft auth is config driven: the login page only offers it when the
 * backend it talks to was started with an `[auth.microsoft]` section. So the
 * run needs two instances -- one per config -- instead of a stubbed
 * `/auth/providers` response, which would not exercise the real wiring.
 *
 * The default instance keeps the ports from `vite.config.ts` and `index.ts`;
 * the Microsoft one sits next to it.
 */

const DATA_DIR = path.resolve(process.cwd(), 'server', 'data')
const CONFIG_DIR = path.resolve(process.cwd(), 'tests', 'e2e', 'config')

export const MICROSOFT_API_PORT = 3001
export const MICROSOFT_APP_PORT = 5372

export const API_URL = 'http://localhost:3000'
export const MICROSOFT_API_URL = `http://localhost:${MICROSOFT_API_PORT}`

export const APP_URL = 'http://localhost:5371'
export const MICROSOFT_APP_URL = `http://localhost:${MICROSOFT_APP_PORT}`

export const CONFIG_PATH = path.join(CONFIG_DIR, 'without-microsoft.toml')
export const MICROSOFT_CONFIG_PATH = path.join(CONFIG_DIR, 'with-microsoft.toml')

export const E2E_DB_PATH = path.join(DATA_DIR, 'e2e.db')
/** The Microsoft instance only serves the login page and never sees the
 * fixtures, so it gets its own file rather than racing on the seeded one. */
export const MICROSOFT_E2E_DB_PATH = path.join(DATA_DIR, 'e2e-microsoft.db')
