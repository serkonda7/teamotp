import {
  handleListOtp,
  handleCreateOtp,
  handleGetOtpCode,
  handleUpdateOtp,
} from './routes/otp'

const PORT = Number(process.env.PORT ?? 3000)

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const { pathname } = url
    const method = req.method.toUpperCase()

    // /api/otp
    if (pathname === '/api/otp') {
      if (method === 'GET') return handleListOtp(req)
      if (method === 'POST') return handleCreateOtp(req)
      return new Response('Method Not Allowed', { status: 405 })
    }

    // /api/otp/:id
    const otpIdMatch = pathname.match(/^\/api\/otp\/([^/]+)$/)
    if (otpIdMatch) {
      const id = otpIdMatch[1]
      if (method === 'GET') return handleGetOtpCode(req, id)
      if (method === 'POST') return handleUpdateOtp(req, id)
      return new Response('Method Not Allowed', { status: 405 })
    }

    return new Response('Not Found', { status: 404 })
  },
})

console.log(`Server listening on http://localhost:${server.port}`)
