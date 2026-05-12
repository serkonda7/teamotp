FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.json ./
RUN mkdir -p client server server-cli shared
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY server-cli/package.json ./server-cli/package.json
COPY shared/package.json ./shared/package.json

RUN bun install --frozen-lockfile --filter server --filter server-cli
COPY shared ./shared
COPY server ./server
COPY server-cli ./server-cli
RUN bun run --filter server compile && bun run --filter server-cli compile


FROM debian:stable-slim

WORKDIR /app

COPY --from=builder /app/server/dist/backend.bin ./
COPY --from=builder /app/server-cli/dist/cli.bin ./cli.bin
COPY --from=builder /app/server/drizzle ./drizzle

EXPOSE 3000

ENTRYPOINT ["./backend.bin"]
