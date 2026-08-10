import type { HashAlgorithm } from 'otplib'

// Kept here for backwards compatibility of the import path. The contract itself
// lives in `shared/src/schemas.ts` next to the runtime schema that enforces it.
export type { UpdateOtpEntry } from 'shared/src/schemas'

export interface OtpEntry {
	id: string
	label: string
	issuer: string
	issuer_second: string
	secret: string
	algorithm: HashAlgorithm
	digits: number
	period: number
	archived_at: string | null
}

export interface User {
	id: string
	email: string
	password_hash: string | null
	provider: string
	provider_id: string | null
}
