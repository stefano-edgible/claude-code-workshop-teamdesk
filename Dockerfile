# Teamdesk image: the built app on Bun, with its SQLite file on a volume at /data.
#   docker build -t teamdesk .
#   docker run -p 3000:3000 -v teamdesk-data:/data -e TEAMDESK_ADMIN_EMAIL=you@example.com teamdesk

FROM oven/bun:1.3.11 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/services/package.json packages/services/
# No lifecycle scripts: `prepare` runs husky, which needs a git checkout.
RUN for i in 1 2 3; do timeout 240 bun install --frozen-lockfile --ignore-scripts && exit 0; done; exit 1
COPY . .
RUN cd apps/web && bun run build

FROM oven/bun:1.3.11 AS deps
WORKDIR /app
# Copied from the build stage only so the two installs run one after the other.
COPY --from=build /app/package.json /app/bun.lock ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/services/package.json packages/services/
RUN for i in 1 2 3; do timeout 240 bun install --frozen-lockfile --production --ignore-scripts && exit 0; done; exit 1

FROM oven/bun:1.3.11-slim
LABEL org.opencontainers.image.source="https://github.com/stefano-edgible/claude-code-workshop-teamdesk" \
      org.opencontainers.image.description="Teamdesk: rooms, bookings and tasks for a small team" \
      org.opencontainers.image.licenses="MIT"
WORKDIR /app/apps/web
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/teamdesk.db \
    MIGRATIONS_DIR=/app/migrations
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./dist
COPY --from=build /app/apps/web/serve.ts ./serve.ts
COPY --from=build /app/packages/db/migrations /app/migrations
RUN mkdir /data && chown bun:bun /data
USER bun
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/api/health'); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "run", "serve.ts"]
