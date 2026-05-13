# girls_band_live — 프로젝트 컨텍스트

애니/게임 기반 걸즈밴드 라이브 일정 아카이브. 일본 티켓팅 라운드 구조(선행/일반/추첨/선착, FC/플레이가이드/공식 선행, 라이브뷰잉/배포)를 그대로 표현하고, iCal 캘린더 구독을 제공한다.

## 스택

- **앱**: Next.js (App Router) + TypeScript
- **스타일**: Tailwind v4 (CSS-first, `tailwind.config.js` 없음) + shadcn/ui
- **DB**: PostgreSQL 16 (docker-compose) + Prisma
- **폼**: React Hook Form + Zod
- **이미지**: MinIO (docker-compose)
- **인증**: 비밀번호 1개 + JWT 쿠키 (어드민 1인)
- **테스트**: Vitest (unit/integration) + Playwright (E2E)
- **패키지매니저**: pnpm 9+

공개 페이지와 어드민(`/admin`)을 **같은 Next.js 앱**으로 운영한다.

## 개발 원칙 — TDD 강제

모든 기능은 다음 순서를 따른다:

1. **planner** 에이전트가 트랙 판별 + `tmp/TODO.md` 작성 (직접 수행 금지)
2. **tdd-author** 에이전트가 실패하는 테스트 작성 (RED)
3. 도메인 implementer 에이전트가 통과시키는 최소 구현 (GREEN)
4. 테스트 다시 실행 후 GREEN 확인
5. **code-reviewer** 에이전트로 리뷰 (CRITICAL/HIGH 수정 필수)
6. 통합 브랜치 머지

자세한 흐름은 `build-feature` 스킬 참조. 모든 구현 작업은 이 스킬을 따른다.

## 데이터 모델 핵심

```
Series (시리즈/IP, optional)         예) 러브라이브, 아이마스
  └─ Work (작품)                     예) 러브라이브!, 뱅드림, 걸즈밴드크라이
        └─ Band                      예) μ's, MyGO!!!!!, 토게토게
              └─ LiveBand ── Live ── ├─ LiveFormat (실황/LV/배포)
                                     │     └─ TicketTier
                                     └─ TicketSale (라운드)
                                           ├─ Vendor
                                           └─ TicketSaleTier (N:M)
```

전체는 `prisma/schema.prisma` 참조. 시각은 **UTC 저장, JST 표시** 고정.

## 시각 처리 컨벤션

- DB: UTC
- 어드민 입력: JST datetime-local (서버에서 UTC 변환)
- UI 표시: 항상 `Asia/Tokyo`. 한국 시각으로 보여주지 말 것 (티켓팅 마감 혼동 위험).

## 디렉토리

```
prisma/              ← schema + migrations
app/                 ← Next.js App Router
  (public)/          ← 공개 페이지 그룹
  admin/             ← 어드민 (미들웨어 보호)
  api/calendar/      ← iCal 피드
components/          ← UI 컴포넌트 (ui/는 shadcn)
lib/                 ← 도메인 로직, 인증, ical 헬퍼
test/                ← 팩토리, 헬퍼
e2e/                 ← Playwright
```

## 프로젝트 에이전트 / 스킬

`.claude/agents/`에 6개 도메인 전문가, `.claude/skills/`에 5개 스킬이 정의되어 있다. **프로젝트 에이전트가 도메인을 커버하면 글로벌 범용 에이전트보다 우선 사용한다.**

### 에이전트 선택 매트릭스

| 작업 | 호출 에이전트 |
|---|---|
| 새 기능 전체 흐름 | (먼저) glob `planner` → `build-feature` 스킬 따라 |
| Prisma 스키마/마이그레이션 | `db-architect` |
| Next.js 페이지/Server Action/인증 | `nextjs-implementer` |
| 어드민 입력 UX 설계 | `admin-ux-designer` |
| iCal 피드 | `ical-engineer` |
| shadcn/Tailwind v4 컴포넌트 | `ui-component-author` |
| 테스트 (TDD RED 단계) | `tdd-author` |
| 코드 리뷰 | (글로벌) `code-reviewer` |
| 보안 리뷰 | (글로벌) `security-reviewer` |
| 빌드 에러 해결 | (글로벌) `build-error-resolver` |

### 스킬

- `build-feature` — **표준 기능 개발 오케스트레이션 (TDD 강제)**
- `japanese-ticketing-domain` — 일본 티켓팅 용어/룰/엣지케이스
- `prisma-migration-safety` — 마이그레이션 안전성
- `ical-rfc5545` — iCal 작성 규칙
- `tdd-vitest-playwright` — 테스트 패턴

## 명령

```bash
pnpm db:up              # Postgres + Adminer 기동
pnpm prisma:migrate     # 마이그레이션 (dev)
pnpm prisma:studio      # Prisma Studio
pnpm dev                # Next.js dev (앞으로 추가)
pnpm test               # Vitest (앞으로 추가)
pnpm test:e2e           # Playwright (앞으로 추가)
```

## 운영 컨벤션

- 브랜치: `feature/xxx`, `fix/xxx`, `refactor/xxx`, `chore/xxx`
- 커밋: `feat: …` / `fix: …` / `refactor: …` 등 conventional
- 통합 브랜치는 `main` 또는 `staging` (초기 셋업 단계)
- pre-commit hook이 타입 체크 + 테스트 자동 실행 (예정)
- 테스트 수동 실행 안 함 — hook이 처리
