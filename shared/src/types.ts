// Required and optional fields per OATH Key Uri format.
// - Link: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
// - Note: issuer_second is not part of the standard but included for better UX
export interface NewOtpEntry {
	label: string
	secret: string
	issuer?: string
	issuer_second?: string
	algorithm?: string
	digits?: number
	period?: number
}

export interface OtpDisplayInfo {
	id: string
	label: string
	issuer: string
	issuer_second: string
	period: number
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
