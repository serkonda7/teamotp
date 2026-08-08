/** Hono RPC client and typed API helpers for server communicating. */
import { Result } from 'better-result'
import { hc } from 'hono/client'
import type { AppType } from 'server/src/index'
import type { UpdateOtpEntry } from 'server/src/types'
import type { OtpDisplayInfo, TagInfo, TagWithMemberCount } from 'shared/src/types'
import { read_api_error } from './util/api_error'

/** RPC client */
export const client = hc<AppType>('/api')

/** Signals that the server rejected a request because the session is gone. */
export class UnauthorizedError extends Error {
	constructor() {
		super('Nicht angemeldet')
		this.name = 'UnauthorizedError'
	}
}

/** Notified on every 401, so the UI can return to the login page. */
let unauthorized_handler: (() => void) | null = null

/**
 * Registers the callback for rejected requests. A 401 can happen at any time
 * because sessions time out, so this is handled centrally instead of per call.
 */
export function set_unauthorized_handler(handler: () => void): void {
	unauthorized_handler = handler
}

/**
 * Wraps a fetch response in a Result: reads a typed API error on failure,
 * otherwise returns the parsed JSON body typed as `T`. Chain `.map()` on the
 * result to project a single field.
 */
async function to_result<T>(res: Response, fallback: string): Promise<Result<T, Error>> {
	if (res.status === 401) {
		unauthorized_handler?.()
		return Result.err(new UnauthorizedError())
	}

	if (!res.ok) {
		const msg = await read_api_error(res, `${fallback} (${res.status})`)
		return Result.err(new Error(msg))
	}

	return Result.ok((await res.json()) as T)
}

/** Fetches all OTP entries for the list view. */
export async function fetch_otps(): Promise<Result<OtpDisplayInfo[], Error>> {
	const res = await client.otp.$get()
	return to_result<OtpDisplayInfo[]>(res, 'Fehler beim Laden der Einträge')
}

/** Fetches current TOTP code for the given entry ID. */
export async function fetch_otp_code(id: string): Promise<Result<string, Error>> {
	const res = await client.otp[':id'].$get({ param: { id } })
	return (await to_result<{ code: string }>(res, 'Fehler beim Laden des OTP-Codes')).map(
		(d) => d.code,
	)
}

/** Updates the editable fields of an entry. */
export async function update_entry(
	id: string,
	fields: UpdateOtpEntry,
): Promise<Result<null, Error>> {
	// biome-ignore lint/suspicious/noExplicitAny: Hono RPC POST with params does not infer json parameter without server schema validator
	const res = await (client.otp[':id'].$post as any)({ param: { id }, json: fields })
	return to_result<null>(res, 'Fehler beim Update des Eintrags')
}

/** Archives an entry, hiding it from the default list. */
export async function archive_entry(id: string): Promise<Result<null, Error>> {
	const res = await client.otp[':id'].archive.$post({ param: { id } })
	return to_result<null>(res, 'Fehler beim Archivieren des Eintrags')
}

/** Fetches all tags with their member counts. */
export async function fetch_tags(): Promise<Result<TagWithMemberCount[], Error>> {
	const res = await client.tags.$get()
	return to_result<TagWithMemberCount[]>(res, 'Fehler beim Laden der Tags')
}

/** Creates a new tag and returns its ID. */
export async function create_tag(name: string, color: string): Promise<Result<string, Error>> {
	const res = await client.tags.$post({ json: { name, color } })
	return (await to_result<{ id: string }>(res, 'Fehler beim Erstellen des Tags')).map((d) => d.id)
}

/** Deletes a tag and all its assignments. */
export async function delete_tag(id: string): Promise<Result<null, Error>> {
	const res = await client.tags[':id'].$delete({ param: { id } })
	return to_result<null>(res, 'Fehler beim Löschen des Tags')
}

/** Fetches tags assigned to the given entry. */
export async function fetch_entry_tags(entryId: string): Promise<Result<TagInfo[], Error>> {
	const res = await client.otp[':id'].tags.$get({ param: { id: entryId } })
	return to_result<TagInfo[]>(res, 'Fehler beim Laden der Tags des Eintrags')
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
	return to_result<null>(res, 'Fehler beim Ändern der Tag-Zuordnung')
}
