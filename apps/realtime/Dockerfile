# Realtime WebSocket service. Build context = repo root (workspace deps).
FROM node:20-alpine
RUN npm install -g pnpm@10
WORKDIR /app

# Install only the realtime service + its workspace deps (skips Next.js).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/realtime/package.json ./apps/realtime/
RUN pnpm install --frozen-lockfile --filter "@deviation/realtime..."

# Source (TypeScript, run via tsx — no separate build step for this small service).
COPY packages/shared ./packages/shared
COPY apps/realtime ./apps/realtime

ENV NODE_ENV=production
ENV PORT=7243
EXPOSE 7243
CMD ["pnpm", "--filter", "@deviation/realtime", "start"]
