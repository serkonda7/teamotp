export type OtpLayoutMode = 'list' | 'grid'

export const DEFAULT_OTP_LAYOUT_MODE: OtpLayoutMode = 'grid'
export const OTP_LAYOUT_MODE_STORAGE_KEY = 'teamotp:otp-layout-mode'

export function readStoredLayoutMode(): OtpLayoutMode {
	try {
		const value = localStorage.getItem(OTP_LAYOUT_MODE_STORAGE_KEY)
		return value === 'list' || value === 'grid' ? value : DEFAULT_OTP_LAYOUT_MODE
	} catch {
		return DEFAULT_OTP_LAYOUT_MODE
	}
}

export function persistLayoutMode(mode: OtpLayoutMode): void {
	try {
		localStorage.setItem(OTP_LAYOUT_MODE_STORAGE_KEY, mode)
	} catch {
		// ignore storage write failures (e.g. privacy mode)
	}
}
