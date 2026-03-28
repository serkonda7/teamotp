import { hc } from 'hono/client'
import type { AppType } from '../../server/src/index'

// TODO read from a config file or env variable
export const client = hc<AppType>('http://localhost:3000')
