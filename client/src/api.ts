/** Hono RPC client and typed API helpers for server communicating. */
import { Result } from 'better-result'
import { hc } from 'hono/client'
import type { AppType } from 'server/src/index'
import { read_api_error } from './util/api_error'

/** RPC client */
export const client = hc<AppType>('/api')

/** Fetches current TOTP code for the given entry ID. */
export async function fetch_otp_code(id: string): Promise<Result<string, Error>> {
	const res = await client.otp[':id'].$get({ param: { id } })
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to fetch OTP code (${res.status})`)
		return Result.err(new Error(msg))
	}

	const data = await res.json()
	return Result.ok(data.code)
}
