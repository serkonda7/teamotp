import { handle_add_otp_entry, handle_get_otp_entries } from './routes/otp.ts'

const server = Bun.serve({
	// TODO: make this configurable
	hostname: '0.0.0.0',
	port: 3000,

	routes: {
		'/api/otp': {
			GET: handle_get_otp_entries,
			POST: handle_add_otp_entry,
		},
	},

	fetch(_req) {
		return new Response('not found', { status: 404 })
	},
})

console.log(`TeamOTP server listening on ${server.url}`)
