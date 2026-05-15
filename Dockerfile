# syntax=docker/dockerfile:1
#
# girls_band_live — Next.js + Prisma production image.
#
# Next.js `output: "standalone"` 모드 활용:
#   - 빌드 시 `.next/standalone/` 에 server.js + 추적된 node_modules 만 추출
#   - pnpm 가상 스토어/symlink 문제 우회
#   - 런타임 이미지 크기 최소화

# -----------------------------------------------------------------------------
# Stage 1: 빌드
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable

# 의존성 캐싱
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 빌드
COPY . .
RUN pnpm prisma generate
RUN pnpm build

# -----------------------------------------------------------------------------
# Stage 2: 런타임
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV TZ=Asia/Tokyo

# 비-root 유저
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# standalone 산출물: server.js + 추적된 node_modules 포함
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/public ./public

# Prisma schema (런타임 client 는 standalone trace 에 포함됨, CLI 는 미포함)
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000

# 컨테이너 헬스체크 — blue/green 배포에서 새 컨테이너의 준비 상태 판정에 사용.
# slim 이미지에 curl/wget 이 없어서 node 의 fetch 사용 (Node 20+ 내장).
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

# 마이그레이션은 컨테이너 시작 전에 별도로 실행해야 한다:
#   pnpm prisma:migrate:deploy  (호스트에서 TEST_DATABASE_URL 또는 DATABASE_URL 지정)
# 또는 일회성 migrator 컨테이너로:
#   docker run --rm --network host -e DATABASE_URL=... \
#     -v $PWD/prisma:/prisma node:20 \
#     npx prisma migrate deploy --schema=/prisma/schema.prisma
CMD ["node", "server.js"]
