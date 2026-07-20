/** Hono RPC client and typed API helpers for server communicating. */
import { Result } from 'better-result'
import { hc } from 'hono/client'
import type { AppType } from 'server/src/index'
import type { TagInfo, TagWithMemberCount } from 'shared/src/types'
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

/** Fetches all tags with their member counts. */
export async function fetch_tags(): Promise<Result<TagWithMemberCount[], Error>> {
	const res = await client.tags.$get()
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to fetch tags (${res.status})`)
		return Result.err(new Error(msg))
	}

	const data = await res.json()
	return Result.ok(data)
}

/** Creates a new tag and returns its ID. */
export async function create_tag(name: string, color: string): Promise<Result<string, Error>> {
	const res = await client.tags.$post({ json: { name, color } })
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to create tag (${res.status})`)
		return Result.err(new Error(msg))
	}

	const data = await res.json()
	return Result.ok(data.id)
}

/** Deletes a tag and all its assignments. */
export async function delete_tag(id: string): Promise<Result<null, Error>> {
	const res = await client.tags[':id'].$delete({ param: { id } })
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to delete tag (${res.status})`)
		return Result.err(new Error(msg))
	}

	return Result.ok(null)
}

/** Fetches tags assigned to the given entry. */
export async function fetch_entry_tags(entryId: string): Promise<Result<TagInfo[], Error>> {
	const res = await client.otp[':id'].tags.$get({ param: { id: entryId } })
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to fetch entry tags (${res.status})`)
		return Result.err(new Error(msg))
	}

	const data = await res.json()
	return Result.ok(data)
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
	if (!res.ok) {
		const msg = await read_api_error(res, `Failed to update tag assignment (${res.status})`)
		return Result.err(new Error(msg))
	}

	return Result.ok(null)
}
