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


FROM nginx:alpine

# Generate self-signed certificates for HTTPS
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/certs && \
    openssl req -x509 -newkey rsa:4096 -keyout /etc/nginx/certs/key.pem -out /etc/nginx/certs/cert.pem -days 365 -nodes -subj "/CN=localhost"

COPY --from=builder /app/client/dist /usr/share/nginx/html
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

ENTRYPOINT [ "nginx", "-g", "daemon off;" ]
