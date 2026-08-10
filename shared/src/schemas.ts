/**
 * Runtime contracts for everything a client may send to the API.
 *
 * The TypeScript types are derived from these schemas instead of being written
 * by hand, so the runtime check and the compile-time type cannot drift apart.
 *
 * The exported types are the schema *inputs* — the shape a caller has to build
 * to make a valid request. Route handlers receive the parsed *output*, which is
 * narrower (normalized case, restricted unions) and therefore always assignable
 * to the input type.
 */
import * as v from 'valibot'

// 10 bytes minimum, matching MIN_SECRET_BYTES in server/src/otp.ts.
// Whitespace is stripped first because authenticator apps print secrets in
// space-separated groups and users paste them that way.
const Base32Secret = v.pipe(
	v.string(),
	v.transform((s) => s.replace(/\s/g, '').toUpperCase()),
	v.regex(/^[A-Z2-7]+=*$/, 'Secret must be Base32'),
	v.minLength(16, 'Secret is too short'),
)

// Required and optional fields per OATH Key Uri format.
// - Link: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
// - Note: issuer_second is not part of the standard but included for better UX
export const NewOtpEntrySchema = v.object({
	label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
	secret: Base32Secret,
	issuer: v.optional(v.pipe(v.string(), v.maxLength(200))),
	issuer_second: v.optional(v.pipe(v.string(), v.maxLength(200))),
	// otpauth:// URLs spell the algorithm in upper case, the stored value is lower case
	algorithm: v.optional(
		v.pipe(v.string(), v.toLowerCase(), v.picklist(['sha1', 'sha256', 'sha512'])),
	),
	digits: v.optional(v.pipe(v.number(), v.integer(), v.picklist([6, 7, 8]))),
	period: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(300))),
})

// strictObject: unknown keys are REJECTED, not silently stripped, so an attempt
// to write `secret` or `id` through the update endpoint fails loudly with a 400.
export const UpdateOtpEntrySchema = v.strictObject({
	label: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200))),
	issuer: v.optional(v.pipe(v.string(), v.maxLength(200))),
	issuer_second: v.optional(v.pipe(v.string(), v.maxLength(200))),
})

export const NewTagSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(50)),
	color: v.pipe(
		v.string(),
		v.regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #1a2b3c'),
		v.toLowerCase(),
	),
})

export type NewOtpEntry = v.InferInput<typeof NewOtpEntrySchema>
export type UpdateOtpEntry = v.InferInput<typeof UpdateOtpEntrySchema>
export type NewTag = v.InferInput<typeof NewTagSchema>
