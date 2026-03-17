# ── deps stage: install only production dependencies ──────────────────────────
FROM oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 brewhub && \
    adduser  --system --uid 1001 --ingroup brewhub brewhub

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=brewhub:brewhub . .

USER brewhub

EXPOSE 3001

CMD ["bun", "src/server.ts"]
