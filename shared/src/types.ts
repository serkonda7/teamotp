// Request payload types live in `schemas.ts`, derived from their runtime schema.
// They are re-exported here so importers keep a single entry point for types.
export type { NewOtpEntry, NewTag, UpdateOtpEntry } from './schemas'

export interface OtpDisplayInfo {
	id: string
	label: string
	issuer: string
	issuer_second: string
	period: number
	tags: TagInfo[]
}

export interface TagInfo {
	id: string
	name: string
	color: string
}

export interface TagWithMemberCount extends TagInfo {
	member_count: number
}

/** JSX helper type for onInput handlers */
export type InputEventAndTarget = InputEvent & {
	currentTarget: HTMLInputElement
	target: HTMLInputElement
}

/** JSX helper type for onClick handlers */
export type MouseEventAndTarget = MouseEvent & {
	currentTarget: HTMLButtonElement
	target: Element
}
