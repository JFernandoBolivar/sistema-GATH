# ── base: Node fijo + pnpm (gestor de paquetes del proyecto) ────────────────
FROM node:26.12.1-alpine3.24 AS base
# libc6-compat: binarios nativos (sharp, swc) compilados contra glibc.
RUN apk add --no-cache libc6-compat \
    && npm install -g pnpm@12.9.1
WORKDIR /app/NextJS

# ── deps: solo dependencias, para aprovechar la caché de capas ──────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── builder: compila con output "standalone" ────────────────────────────────
FROM base AS builder
COPY --from=deps /app/NextJS/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── runner: imagen final, sin node_modules completo y sin root ──────────────
FROM node:26.12.1-alpine3.24 AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app/NextJS
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/NextJS/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/NextJS/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
