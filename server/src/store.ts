import type { CreateOtpEntryDto, OtpEntry, UpdateOtpEntryDto } from './types'

// Stub in-memory store — replace with a real database later
const entries = new Map<string, OtpEntry>()

export function listEntries(): OtpEntry[] {
	return Array.from(entries.values())
}

export function getEntry(id: string): OtpEntry | undefined {
	return entries.get(id)
}

export function createEntry(dto: CreateOtpEntryDto): OtpEntry {
	const now = new Date().toISOString()
	const entry: OtpEntry = {
		id: crypto.randomUUID(),
		name: dto.name,
		issuer: dto.issuer,
		secret: dto.secret,
		createdAt: now,
		updatedAt: now,
	}
	entries.set(entry.id, entry)
	return entry
}

export function updateEntry(id: string, dto: UpdateOtpEntryDto): OtpEntry | undefined {
	const existing = entries.get(id)
	if (!existing) return undefined

	const updated: OtpEntry = {
		...existing,
		...dto,
		updatedAt: new Date().toISOString(),
	}
	entries.set(id, updated)
	return updated
}
