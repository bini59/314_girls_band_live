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

## 디자인 시스템

**모든 UI 작업은 `.claude/DESIGN.md`를 반드시 참조한다.** Spotify 영감의 다크 테마 디자인 시스템(색상 토큰, 타이포그래피, 버튼/카드/입력 패턴, 그림자, 라운드 규칙)이 정의되어 있다. 어드민·공개 페이지 모두 동일한 토큰 체계를 따른다.

- 색상/그림자/라운드/타이포는 DESIGN.md의 토큰을 사용하고, 임의 값(예: `bg-gray-800`, `rounded-md`)을 박지 않는다.
- shadcn/ui 컴포넌트를 도입·수정할 때는 DESIGN.md의 매핑 규칙을 우선 적용한다.
- 새 컴포넌트는 `ui-component-author` 에이전트에게 위임하되, 항상 DESIGN.md를 참조 컨텍스트로 넘긴다.

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

### 브랜치 전략

- **`main`** — 프로덕션. **직접 커밋·푸시 금지.** push 시 GitHub Actions `deploy.yml`이 GHCR 빌드/푸시 + 배포 서버에 SSH 배포를 실행한다.
- **`dev`** — 통합 브랜치. 모든 작업의 베이스. 일상 작업은 여기에 머지된다.
- **feature 브랜치** — `feature/xxx`, `fix/xxx`, `refactor/xxx`, `chore/xxx`. **반드시 `dev`에서 분기**하고 작업 종료 후 `dev`에 머지한다 (PR 또는 fast-forward).
- **릴리즈** — `dev`가 안정화되면 `dev → main` PR을 올린다. PR이 열리면 `ci.yml`(lint + typecheck + vitest)이 실행되며, **모든 잡이 GREEN이어야 머지 가능**.

```
feature/xxx ──merge──▶ dev ──PR──▶ main ──push trigger──▶ deploy (GHCR + SSH)
                        ▲                    ▲
                        │                    │
                        └ 일상 작업 통합      └ CI: lint + tsc + vitest (must pass)
```

### 워크플로 약속

- 커밋: `feat: …` / `fix: …` / `refactor: …` 등 conventional
- 새 작업 시작 시 베이스 브랜치 확인: `git checkout dev && git pull` → `git checkout -b feature/xxx`
- `main`에 직접 푸시하지 않는다. 항상 `dev` 경유 PR.
- `dev → main` PR 머지 후 자동 배포되므로, 머지 전에 dev에서 충분히 검증한다.
- pre-commit hook이 타입 체크 + 테스트 자동 실행 (예정). 수동 실행 안 함.

### CI/CD 파이프라인

- `.github/workflows/ci.yml` — `pull_request → main` 및 `push → dev` 트리거. lint + typecheck + vitest(Postgres service) 실행.
- `.github/workflows/deploy.yml` — `push → main` 트리거. Docker 이미지 GHCR 푸시 → SSH로 배포 서버에서 **`scripts/deploy-blue-green.sh`** 실행. 필요한 시크릿:
  - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PORT`(선택), `DEPLOY_PATH`
  - `GHCR_USER`, `GHCR_TOKEN` (서버에서 GHCR pull 권한)
  - 서버 측 `.env`: `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `JWT_SECRET`, `POSTGRES_PASSWORD`

### 무중단 배포 (nginx + blue/green)

외부 트래픽은 항상 **nginx**가 받고, 뒤에 `app-blue`/`app-green` 중 한 색만 살아 있다.
배포 시 반대 색을 새 이미지로 띄워 healthy 가 된 뒤 nginx upstream을 전환하므로 다운타임이 발생하지 않는다.

```
[Internet] ─▶ nginx:80 ─▶ upstream app_backend ─▶ app-blue:3000   (active)
                                                  app-green:3000  (stopped)

배포: app-green 기동 → healthy 대기 → upstream을 green 으로 갱신 → nginx -s reload → app-blue stop
```

핵심 파일:

- `docker-compose.yml` — `nginx`, `app-blue`, `app-green` 모두 `profiles: ["app"]`. 외부 포트는 nginx만 노출.
- `nginx/nginx.conf` — 공통 리버스 프록시 설정. `upstream app_backend` 가 `conf.d/active-upstream.conf` 를 include.
- `nginx/conf.d/active-upstream.conf` — 활성 색 한 줄(`server app-blue:3000;` 또는 `server app-green:3000;`). **배포 스크립트가 갱신하는 유일한 파일.**
- `scripts/deploy-blue-green.sh` — 현재 색 감지 → 새 이미지 pull → prisma migrate → 반대 색 기동 → healthcheck 대기 → upstream 전환 → nginx reload → 구 색 stop. 실패 시 자동 롤백.
- `app/api/health/route.ts` — Dockerfile `HEALTHCHECK` 가 호출하는 헬스 엔드포인트.

서버 최초 부트스트랩(1회):

```bash
# 서버에서, DEPLOY_PATH 디렉토리 내부
docker login ghcr.io -u <user> -p <token>
docker compose --profile app up -d postgres nginx
# 이후 첫 GitHub Actions 배포가 알아서 app-blue/green 을 띄운다
```

롤백:

- `nginx/conf.d/active-upstream.conf` 를 직전 색으로 되돌리고 `docker compose exec nginx nginx -s reload`.
- 또는 `git revert` 후 main 머지 → 재배포.
