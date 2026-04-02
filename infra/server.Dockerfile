FROM oven/bun:1-slim AS builder

WORKDIR /app

COPY package.json bun.lock ./
COPY tsconfig.json ./
RUN mkdir -p client server shared
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
COPY shared/package.json ./shared/package.json

RUN bun install --frozen-lockfile --production --filter server
COPY shared ./shared
COPY server ./server
RUN cd server && bun run compile


FROM debian:stable-slim

WORKDIR /app

COPY --from=builder /app/server/dist/server ./

EXPOSE 3000

ENTRYPOINT ["./server"]
