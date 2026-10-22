# girls_band_live

애니/게임 기반 걸즈밴드 라이브 일정 아카이브.

일본 티켓팅 라운드 구조(선행/일반/추첨/선착, 라이브뷰잉/배포 포함)를 그대로 표현하고, iCal 캘린더 구독을 지원하는 웹 서비스를 목표로 한다.

## Stack

Cloudflare Workers / D1(SQLite), Next.js 15 / React 19, Prisma 7, Node 22.12+, pnpm 9.

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate # local D1 only
pnpm db:seed        # local vendor seed
pnpm dev
```

`pnpm test:run`은 별도 ephemeral workerd D1에서 unit/integration 테스트를 실행한다.
Docker / TEST_DATABASE_URL 설정은 필요하지 않다.
`pnpm build:worker` → `pnpm test:worker`로 빌드된 Worker와 임시 D1의 실제 DB 요청을 검증한다.
`pnpm exec wrangler dev --local`로 개발 DB를 사용하는 Worker를 수동 확인할 수 있다.
[전환 절차와 롤백](docs/d1-cutover.md)을 참고한다. 리소스 생성과 운영 데이터 이전은 운영자가 수행한다.

## 어드민 인증

운영 backoffice 인증은 `321_auth` SSO를 사용합니다. `gbl` 서비스에 활성 `admin` membership이 있는 계정만 접근할 수 있습니다.

필수 환경변수:

```env
AUTH_ORIGIN=https://auth.bini59.dev
CLIENT_ID=gbl
APP_ORIGIN=https://band-live.bini59.dev
AUTH_REQUIRED_ROLE=admin
APP_SECRET=server-only-secret
```

`APP_SECRET`은 서버 환경변수로만 주입하고 브라우저 번들에 포함하지 않습니다. `/admin` 접근 시 `321_auth /verify`를 서버에서 호출하며, 인증 서비스 장애는 fail-closed 됩니다.

로컬 테스트나 SSO 설정이 없는 개발 환경에서는 기존 password/JWT 테스트 경로를 유지합니다.

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

## Production 배포

기존 Docker 배포와 새 Workers workflow는 모두 수동 실행이다.
현재 브랜치의 Docker 이미지는 운영용으로 사용하지 않는다. 전환/롤백은 [runbook](docs/d1-cutover.md)을 따른다.

## Endpoints (개발)

Next dev: http://localhost:3000. Worker preview: http://localhost:8787. D1은 Wrangler 로컬 바인딩을 사용한다.

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
