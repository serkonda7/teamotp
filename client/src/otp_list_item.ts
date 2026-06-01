import { Result } from 'better-result'
import { client } from './api'
import { read_api_error } from './util/api_error'

export async function fetch_otp_code(id: string): Promise<Result<string, Error>> {
	const res = await client.otp[':id'].$get({ param: { id } })
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to fetch OTP code (${res.status})`)
		return Result.err(new Error(msg))
	}

	const data = (await res.json()) as { code: string }
	return Result.ok(data.code)
}
