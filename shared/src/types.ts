// Required and optional fields per RFC 6238
export interface NewOtpEntry {
	label: string
	secret: string
	issuer?: string
	algorithm?: string
	digits?: number
	period?: number
}

export interface OtpDisplayInfo {
	id: string
	label: string
	issuer: string
}
