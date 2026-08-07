/** Hono RPC client and typed API helpers for server communicating. */
import { Result } from 'better-result'
import { hc } from 'hono/client'
import type { AppType } from 'server/src/index'
import type { TagInfo, TagWithMemberCount } from 'shared/src/types'
import { read_api_error } from './util/api_error'

/** RPC client */
export const client = hc<AppType>('/api')

/**
 * Wraps a fetch response in a Result: reads a typed API error on failure,
 * otherwise returns the parsed JSON body typed as `T`. Chain `.map()` on the
 * result to project a single field.
 */
async function to_result<T>(res: Response, fallback: string): Promise<Result<T, Error>> {
	if (!res.ok) {
		const msg = await read_api_error(res, `${fallback} (${res.status})`)
		return Result.err(new Error(msg))
	}

	return Result.ok((await res.json()) as T)
}

/** Fetches current TOTP code for the given entry ID. */
export async function fetch_otp_code(id: string): Promise<Result<string, Error>> {
	const res = await client.otp[':id'].$get({ param: { id } })
	return (await to_result<{ code: string }>(res, 'Failed to fetch OTP code')).map((d) => d.code)
}

/** Fetches all tags with their member counts. */
export async function fetch_tags(): Promise<Result<TagWithMemberCount[], Error>> {
	const res = await client.tags.$get()
	return to_result<TagWithMemberCount[]>(res, 'Failed to fetch tags')
}

/** Creates a new tag and returns its ID. */
export async function create_tag(name: string, color: string): Promise<Result<string, Error>> {
	const res = await client.tags.$post({ json: { name, color } })
	return (await to_result<{ id: string }>(res, 'Failed to create tag')).map((d) => d.id)
}

/** Deletes a tag and all its assignments. */
export async function delete_tag(id: string): Promise<Result<null, Error>> {
	const res = await client.tags[':id'].$delete({ param: { id } })
	return to_result<null>(res, 'Failed to delete tag')
}

/** Fetches tags assigned to the given entry. */
export async function fetch_entry_tags(entryId: string): Promise<Result<TagInfo[], Error>> {
	const res = await client.otp[':id'].tags.$get({ param: { id: entryId } })
	return to_result<TagInfo[]>(res, 'Failed to fetch entry tags')
}

/** Assigns or unassigns a tag to/from an entry. */
export async function set_entry_tag(
	entryId: string,
	tagId: string,
	assigned: boolean,
): Promise<Result<null, Error>> {
	const res = assigned
		? await client.otp[':id'].tags[':tagId'].$put({ param: { id: entryId, tagId } })
		: await client.otp[':id'].tags[':tagId'].$delete({ param: { id: entryId, tagId } })
	return to_result<null>(res, 'Failed to update tag assignment')
}
