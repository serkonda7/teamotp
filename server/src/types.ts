export interface OtpEntry {
  id: string
  name: string
  issuer?: string
  secret: string
  createdAt: string
  updatedAt: string
}

export interface CreateOtpEntryDto {
  name: string
  issuer?: string
  secret: string
}

export interface UpdateOtpEntryDto {
  name?: string
  issuer?: string
  secret?: string
}
