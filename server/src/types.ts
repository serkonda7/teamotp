import type { HashAlgorithm } from 'otplib'
export interface OtpEntry {
	id: string
	label: string
	issuer: string
	issuer_second: string
	secret: string
	algorithm: HashAlgorithm
	digits: number
	period: number
}

// Other fields are not updatable
export interface UpdateOtpEntry {
	label?: string
	issuer?: string
	issuer_second?: string
}

export interface User {
	id: string
	email: string
	password_hash: string | null
	provider: string
	provider_id: string | null
}
