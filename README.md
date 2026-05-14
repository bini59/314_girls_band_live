# girls_band_live

애니/게임 기반 걸즈밴드 라이브 일정 아카이브.

일본 티켓팅 라운드 구조(선행/일반/추첨/선착, 라이브뷰잉/배포 포함)를 그대로 표현하고, iCal 캘린더 구독을 지원하는 웹 서비스를 목표로 한다.

## Stack

- **DB**: PostgreSQL 16 (docker-compose)
- **DB Admin**: Adminer (docker-compose)
- **ORM**: Prisma
- **Runtime**: Node.js 20+, pnpm 9+

## Quick Start

```bash
# 1. 환경변수 준비
cp .env.example .env

# 2. 의존성 + DB 기동 + 마이그레이션을 한 번에
pnpm setup

# 또는 단계별로:
pnpm install          # 의존성 설치
pnpm db:up            # Postgres + Adminer 컨테이너 기동
pnpm prisma:migrate   # 마이그레이션 실행 (최초 1회는 이름 입력)
```

## Scripts

| 명령 | 설명 |
|------|------|
| `pnpm db:up` | Postgres + Adminer 컨테이너 기동 |
| `pnpm db:down` | 컨테이너 종료 (데이터는 볼륨에 보존) |
| `pnpm db:reset` | **볼륨 포함 완전 초기화** 후 재기동 |
| `pnpm db:logs` | Postgres 로그 팔로우 |
| `pnpm prisma:migrate` | 개발용 마이그레이션 (`prisma migrate dev`) |
| `pnpm prisma:migrate:deploy` | 운영용 마이그레이션 적용 |
| `pnpm prisma:generate` | Prisma Client 재생성 |
| `pnpm prisma:studio` | Prisma Studio (브라우저 DB 관리 UI) |

## 어드민 dev 인증

`/admin/login` 으로 어드민 로그인이 가능하려면 dev 서버에 `ADMIN_PASSWORD_HASH` + `JWT_SECRET` 환경변수가 필요합니다.

**주의**: `.env` 또는 `.env.local` 에 bcrypt 해시(`$2a$...`)를 넣으면 Next.js 의 dotenv-expand 가 `$2a`, `$04$xxx` 같은 패턴을 변수 reference 로 해석해 값이 깨집니다. single-quote 도 안 통합니다. 다음 방법 중 하나를 사용하세요:

```bash
# 옵션 1: shell export 후 dev 시작
export ADMIN_PASSWORD_HASH='$2a$12$your_hash_here'
export JWT_SECRET='your_32_byte_hex_secret'
pnpm dev

# 옵션 2: inline env
ADMIN_PASSWORD_HASH='$2a$12$your_hash' JWT_SECRET='secret' pnpm dev

# 비밀번호 해시 생성
pnpm tsx -e "import bcrypt from 'bcryptjs'; console.log(bcrypt.hashSync('YOUR_PASSWORD', 12))"
# JWT_SECRET 생성
openssl rand -hex 32
```

`.env` 파일에 그 두 키 자체를 두면 안 됩니다(주석 제외). 운영 배포에서는 외부 환경변수 주입 (Docker secret, K8s, Vercel env) 으로 처리합니다.

E2E 테스트는 자동으로 `webServer.env` 에 자체 평문/해시 쌍을 주입하므로 별도 설정 불필요합니다.

## Production 배포 (로컬/Docker)

`docker-compose.yml` 의 `app` 서비스(profile=app)가 production Next.js 컨테이너를 빌드/실행합니다.

### 빠른 시작 (로컬에서 production 빌드 검증)

```bash
# 1. 비밀번호 해시 + JWT 시크릿 생성
pnpm tsx -e "import bcrypt from 'bcryptjs'; console.log(bcrypt.hashSync('YOUR_PASSWORD', 12))"
openssl rand -hex 32

# 2. DB 가 떠 있는지 확인 (없으면 기동)
pnpm db:up

# 3. (최초 1회) 마이그레이션 적용 — 컨테이너에 prisma CLI 없음
pnpm prisma:migrate:deploy

# 4. 환경변수 inject 해서 app 컨테이너 빌드/기동
ADMIN_PASSWORD_HASH='$2a$12$....hash..' \
JWT_SECRET='....64hex..' \
docker compose --profile app up -d --build app

# 5. http://localhost:3001 로 접속 (APP_PORT 환경변수로 변경 가능)
```

### 환경별 시크릿 주입 패턴

`.env*` 파일에 bcrypt 해시(`$2a$...`)를 두면 안 됩니다 (위 "어드민 dev 인증" 참조).
다음 방법으로 process.env 에 직접 주입:

| 환경 | 방법 |
|---|---|
| **Vercel / Railway / Cloudflare** | UI 의 환경변수 입력 — 가장 안전, expand 없음 |
| **K8s** | `Secret` (stringData) → Pod envFrom |
| **Docker run** | `-e ADMIN_PASSWORD_HASH='$2a$...'` (single-quote 로 셸 expand 차단) |
| **Docker compose** | `environment: ADMIN_PASSWORD_HASH: ${VAR}` interpolation + 호스트 shell 에서 `export` |
| **로컬 셸** | `export ADMIN_PASSWORD_HASH='...'` 후 `pnpm start` |

compose 의 `${VAR}` 가 호스트 shell 변수를 참조하므로, CI/CD 에서는 그 shell 변수만 시크릿 매니저 (GitHub Actions secrets, Vault 등) 에서 주입하면 됩니다.

### Dockerfile 노트

- Multi-stage: `node:20-bookworm-slim` (Alpine 대신 — Prisma + OpenSSL 호환)
- Next.js `output: "standalone"` 모드로 server.js + 필요한 node_modules 만 추출
- `bcryptjs` 는 Server Action 안에서만 import 되어 trace 누락 → `outputFileTracingIncludes` 로 명시 포함
- 비-root 유저 (nextjs:nodejs, uid 1001) 로 실행
- **마이그레이션은 컨테이너에 포함하지 않음** — `pnpm prisma:migrate:deploy` 를 별도로 실행해야 함 (CI/CD step 또는 일회성 migrator 컨테이너)

## Endpoints (개발)

| 서비스 | URL | 비고 |
|--------|-----|------|
| Postgres | `localhost:5432` | user=`gbl`, db=`girls_band_live` |
| Adminer | http://localhost:8080 | System=PostgreSQL, Server=`postgres` |
| Prisma Studio | http://localhost:5555 | `pnpm prisma:studio` 실행 시 |

## 데이터 모델 개요

```
Series (시리즈/IP, optional)             예) 러브라이브, 아이마스
  └─ Work (작품)                          예) 러브라이브!, 뱅드림, 걸즈밴드크라이
        └─ Band                           예) μ's, MyGO!!!!!, 토게토게
              └─ LiveBand ─── Live (공연 1건)
                               ├─ LiveFormat (실황/LV/배포)
                               │     └─ TicketTier (S석/스탠딩/LV일반 등)
                               └─ TicketSale (선행/일반/추첨/선착)
                                     ├─ Vendor (e+/로손/FC 등)
                                     └─ TicketSaleTier (라운드↔티어 N:M)
```

- **Series**는 묶을 필요가 있을 때만 (예: 러브라이브 시리즈). 단일 작품 IP(뱅드림, 걸즈밴드크라이)는 Work만 두고 `seriesId=null`.

상세는 `prisma/schema.prisma` 참고.

### 시각 처리 규칙

- DB는 모든 시각을 **UTC**로 저장
- UI 표시는 **JST (Asia/Tokyo) 고정** — 티켓팅 마감 혼동 방지

## 라이선스

미정 (개인 프로젝트, 미공개).
