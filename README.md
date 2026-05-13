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
