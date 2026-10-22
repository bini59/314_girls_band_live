# AGENTS — girls_band_live

애니/게임 기반 걸즈밴드 라이브 일정 아카이브. Next.js 15 / React 19 / Prisma 7 / D1(SQLite) / pnpm 9 / Node 22.12+.
도메인 용어는 [CONTEXT.md](CONTEXT.md), 스키마는 `prisma/schema.prisma`.

## 불변 컨벤션

- **UTC 저장 / JST 표시** — DB는 UTC, 어드민 입력은 JST datetime-local, UI 표시는 항상 `Asia/Tokyo`. 한국 시각 표시 금지.
- 어드민 인증은 `321_auth` SSO(`/admin`, 서버에서 `/verify` 호출, fail-closed). SSO 미설정 로컬은 password/JWT 경로 유지.
- `.env`에 bcrypt 해시(`$2a$…`)를 직접 넣지 말 것 — dotenv-expand가 깨뜨림 (README 참조).

## 명령

- 검증: `pnpm typecheck`, `pnpm lint`, `pnpm test:run` (husky pre-commit이 같은 순서로 실행. 우회는 `--no-verify`).
- 통합 테스트 DB: Vitest가 ephemeral Miniflare D1을 생성한다. 개발 DB는 `pnpm prisma:migrate` (`--local`).
- E2E: `pnpm test:e2e`.
- Worker 번들 변경 후: `pnpm build:worker` → `pnpm test:worker` (임시 로컬 D1로 실제 DB 요청 검증).
- 스키마 변경 후: `prisma migrate diff`로 D1 SQL 생성 → `pnpm prisma:migrate` (`--local`) → `pnpm prisma:generate`.

## 브랜치 / 릴리즈

`feature/* → (PR) → main`. D1 전환 중 배포 workflow는 수동 실행이다. 전환 절차는 `docs/d1-cutover.md`. main 직접 push 금지.
릴리즈·핫픽스·롤백 절차는 `release` 스킬(`.agents/skills/release/SKILL.md`). 티켓→머지 전체를 한 번에 진행할 때는 `dev-flow` 스킬을 쓸 수 있다(일반 수정에 필수는 아님).

## graphify

`graphify-out/graph.json`이 있으면 코드베이스 전반·의존 관계 질문은 `graphify query "<질문>"` / `graphify path "<A>" "<B>"` / `graphify explain "<개념>"`로 먼저 범위를 잡는다. 알고 있는 파일의 소규모 수정은 바로 읽고 고쳐도 된다. 코드 수정 후 `graphify update .`.
`graphify-out/GRAPH_REPORT.md`는 넓은 아키텍처 리뷰 때만.

## git push 인증

`.envrc`가 `~/Desktop/07_Project/.envrc`의 `GITHUB_TOKEN`(레포 소유자 `bini59`)을 로드한다.
direnv가 없는 셸에서는 `eval "$(direnv export bash)"`로 주입한다.
토큰 값을 `.envrc`에 복사하지 말 것 — 이 파일은 git 추적 대상이다.
gh CLI는 키체인에 `kevin-lim59`가 활성 계정으로 남아 있어도 `GITHUB_TOKEN`이 우선한다.
