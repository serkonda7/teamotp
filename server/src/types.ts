export interface OtpEntry {
	id: string
	label: string
	issuer: string
	secret: string
	algorithm: string
	digits: number
	period: number
}

// Required and optional fields per RFC 6238
export interface NewOtpEntry {
	label: string
	secret: string
	issuer?: string
	algorithm?: string
	digits?: number
	period?: number
}

// Other fields are not updatable
export interface UpdateOtpEntry {
	label?: string
	issuer?: string
}
