export type OtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512'
export type OtpDigits = 6 | 8
export type OtpPeriod = 30 | 60

export type OtpEntry = {
	label: string
	secret: string
	issuer: string
	algorithm: OtpAlgorithm
	digits: OtpDigits
	period: OtpPeriod
}

// Fields required for creating a new entry
export type NewOtpEntry = {
	label: string
	secret: string
	issuer?: string
	algorithm?: OtpAlgorithm
	digits?: OtpDigits
	period?: OtpPeriod
}
