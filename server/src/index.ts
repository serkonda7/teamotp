import { handleCreateOtp, handleGetOtpCode, handleListOtp, handleUpdateOtp } from './routes/otp'

const server = Bun.serve({
	hostname: '0.0.0.0',
	port: 3000,

	routes: {
		'/api/otp': {
			GET: handleListOtp,
			POST: handleCreateOtp,
		},
		'/api/otp/:id': {
			GET: (req) => handleGetOtpCode(req, req.params.id),
			POST: (req) => handleUpdateOtp(req, req.params.id),
		},
	},

	fetch(_req) {
		return new Response('not found', { status: 404 })
	},
})

console.log(`TeamOTP server listening on ${server.url}`)
