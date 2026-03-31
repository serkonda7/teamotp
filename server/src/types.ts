import type { HashAlgorithm } from 'otplib'

export interface OtpEntry {
	id: string
	label: string
	issuer: string
	secret: string
	algorithm: HashAlgorithm
	digits: number
	period: number
}

// Other fields are not updatable
export interface UpdateOtpEntry {
	label?: string
	issuer?: string
}
