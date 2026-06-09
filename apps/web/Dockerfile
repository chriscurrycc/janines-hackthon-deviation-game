# Next.js web app (standalone output). Build context = repo root (workspace deps).
FROM node:20-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

# --- deps: install web + its workspace deps (skips the realtime service's deps) ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
COPY apps/realtime/package.json ./apps/realtime/
RUN pnpm install --frozen-lockfile --filter "@deviation/web..."

# --- build: produce the standalone server ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @deviation/web build

# --- runner: minimal image, runs the traced standalone output ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=7242
# Standalone output mirrors the monorepo layout (outputFileTracingRoot = repo root).
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 7242
CMD ["node", "apps/web/server.js"]
