import type { NewOtpEntry } from '../../shared/models/otp.ts'
import { entries_table } from '../db/schema.ts'
import { db } from '../index.ts'
import { Status } from '../models/http.ts'

export async function handle_get_otp_entries(_req: Request): Promise<Response> {
	try {
		const entries = db
			.select({
				id: entries_table.id,
				label: entries_table.label,
				issuer: entries_table.issuer,
			})
			.from(entries_table)
			.all()
		return Response.json(entries, { status: Status.OK })
	} catch (error) {
		console.error('Failed to get OTP entries:', error)
		return Response.json(
			{ error: 'Internal server error' },
			{ status: Status.INTERNAL_SERVER_ERROR },
		)
	}
}

export async function handle_add_otp_entry(req: Request): Promise<Response> {
	try {
		const body = (await req.json()) as NewOtpEntry

		if (!body.label || !body.secret) {
			return Response.json({ error: 'Missing label or secret' }, { status: Status.BAD_REQUEST })
		}

		const entry: typeof entries_table.$inferInsert = {
			label: body.label,
			issuer: body.issuer ?? '',
			secret: body.secret,
			algorithm: body.algorithm ?? 'SHA1',
			digits: body.digits ?? 6,
			period: body.period ?? 30,
		}

		// TODO implement: Only 6 digit TOTPs are supported for now
		if (entry.digits !== 6) {
			return Response.json(
				{ error: 'Only 6 digit TOTPs are supported for now. Please raise an issue' },
				{ status: Status.INTERNAL_SERVER_ERROR },
			)
		}

		// TODO implement: Only 30s period is supported for now
		if (entry.period !== 30) {
			return Response.json(
				{ error: 'Only 30s period is supported for now. Please raise an issue' },
				{ status: Status.INTERNAL_SERVER_ERROR },
			)
		}

		// TODO implement: Only SHA1 algorithm is supported for now
		if (entry.algorithm !== 'SHA1') {
			return Response.json(
				{ error: 'Only SHA1 algorithm is supported for now. Please raise an issue' },
				{ status: Status.INTERNAL_SERVER_ERROR },
			)
		}

		const id_obj = await db.insert(entries_table).values(entry).returning({ id: entries_table.id })

		return Response.json(id_obj, { status: Status.OK })
	} catch (error) {
		console.error('Failed to add OTP entry:', error)
		return Response.json(
			{ error: 'Internal server error' },
			{ status: Status.INTERNAL_SERVER_ERROR },
		)
	}
}
