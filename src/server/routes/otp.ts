import { db } from '../../services/db.ts'
import type { NewOtpEntry } from '../../shared/models/otp.ts'
import { Status } from '../models/http.ts'

export async function handle_get_otp_entries(_req: Request): Promise<Response> {
	try {
		const entries = db
			.query('SELECT id, label, issuer, algorithm, digits, period FROM entries')
			.all()
		return Response.json(entries, { status: Status.OK })
	} catch (error) {
		console.error('Failed to get OTP entries:', error)
		return Response.json({ error: 'Internal server error' }, { status: 500 })
	}
}

export async function handle_add_otp_entry(req: Request): Promise<Response> {
	try {
		const body = (await req.json()) as NewOtpEntry

		if (!body.label || !body.secret) {
			return Response.json({ error: 'Missing label or secret' }, { status: Status.BAD_REQUEST })
		}

		const id = crypto.randomUUID()

		const entry = {
			id,
			label: body.label,
			issuer: body.issuer ?? '',
			secret: body.secret,
			algorithm: body.algorithm ?? 'SHA1',
			digits: body.digits ?? 6,
			period: body.period ?? 30,
		}

		db.run(
			`INSERT INTO entries (
				id, label, issuer, secret, algorithm, digits, period
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.id,
				entry.label,
				entry.issuer,
				entry.secret,
				entry.algorithm,
				entry.digits,
				entry.period,
			],
		)

		return Response.json({ id }, { status: Status.OK })
	} catch (error) {
		console.error('Failed to add OTP entry:', error)
		return Response.json(
			{ error: 'Internal server error' },
			{ status: Status.INTERNAL_SERVER_ERROR },
		)
	}
}
