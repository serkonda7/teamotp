FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.json ./
RUN mkdir -p client server shared
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

RUN bun install --frozen-lockfile --filter client
COPY shared ./shared
COPY client ./client
RUN cd client && bun run build


FROM caddy:2-alpine

# Generate a self-signed cert for local HTTPS.
RUN apk add --no-cache openssl && \
		mkdir -p /etc/caddy/certs && \
		openssl req -x509 -newkey rsa:4096 \
			-keyout /etc/caddy/certs/key.pem \
			-out /etc/caddy/certs/cert.pem \
			-days 365 -nodes -subj "/CN=localhost" \
			-addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:0.0.0.0"

COPY --from=builder /app/client/dist /usr/share/caddy
COPY infra/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
