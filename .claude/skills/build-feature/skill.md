---
name: build-feature
description: girls_band_live의 표준 TDD 기반 기능 개발 오케스트레이션. 새 기능 추가·기존 기능 변경·버그 수정·스키마 변경 시 반드시 이 스킬을 따른다. 트랙 판별 → 테스트 작성(RED) → 구현(GREEN) → 검증 → 통합 순서로 도메인 에이전트들을 조율한다. "기능 추가", "구현해줘", "만들어줘", "고쳐줘" 등 모든 구현 작업에서 트리거.
---

# build-feature — TDD 기반 기능 개발 오케스트레이션

본 프로젝트는 **TDD 강제**다. 테스트 없이 구현으로 가는 흐름을 차단하고, 도메인별 전문 에이전트를 올바른 순서로 호출하는 게 이 스킬의 역할이다.

## 실행 모드

**에이전트 팀 모드**. 메인 세션(오케스트레이터)이 트랙 판별 후 필요한 에이전트들을 조합한다.

## Phase 0: 작업 시작 전 체크

다음을 확인하고 시작:

- [ ] `prisma/schema.prisma` 최신 상태인지 (수동 변경 있었으면 db-architect 먼저)
- [ ] 작업 브랜치가 통합 브랜치(`main` 또는 `staging`)에서 분기됐는지
- [ ] `tmp/TODO.md`가 깨끗한지 (이전 작업 잔재 없는지)

## Phase 1: planner 위임

**메인 세션은 직접 트랙 판별을 하지 않는다.** 글로벌 `planner` 서브에이전트를 호출:

```
Agent(planner, model: "opus", prompt: "
[기능 명세 원문]

프로젝트: girls_band_live (Next.js + Prisma + PostgreSQL)
컨텍스트: .claude/CLAUDE.md 및 prisma/schema.prisma 참조

트랙 판별 후 tmp/TODO.md 생성. 트랙 기준:
- 수정 파일 5개 이하, 단일 관심사 → light
- 수정 파일 6개 이상 또는 독립 병렬 그룹 2+ → heavy
")
```

planner는 `tmp/TODO.md`에 다음을 채워야 한다:
- `track: light` 또는 `track: heavy`
- 변경 대상 파일/모듈 목록
- 필요한 도메인 에이전트 (db-architect, nextjs-implementer, admin-ux-designer, ical-engineer, ui-component-author 중)
- TDD 테스트가 검증해야 할 행동 목록

## Phase 2: 테스트 우선 작성 (RED)

`tdd-author` 호출 — **항상**, 트랙 무관:

```
Agent(tdd-author, model: "opus", prompt: "
tmp/TODO.md를 읽고 RED 단계 테스트 작성.

요구:
- Unit + Integration + E2E (필요한 레이어만)
- 실행 후 실패 확인 로그 첨부
- 구현해야 할 함수 시그니처 명시
")
```

테스트 파일이 생성되고 RED 증거가 있는지 확인 후 다음 Phase로.

## Phase 3: 구현 (GREEN)

`tmp/TODO.md`의 필요 에이전트에 따라:

### 경량 트랙 (track: light)

순차 호출:
1. 스키마 변경 있으면 → `db-architect`
2. UI 컴포넌트 필요하면 → `ui-component-author`
3. 페이지/액션 → `nextjs-implementer`
4. iCal 변경 → `ical-engineer`
5. 어드민 UX 설계 필요 → `admin-ux-designer` (구현 전에)

각 호출에 다음 명시:
- "테스트가 이미 작성되어 있다 — `*.test.ts` 통과시켜라"
- "테스트 코드 수정 금지. 통과시키려고 테스트 약화 시도하지 말 것"

### 중량 트랙 (track: heavy)

planner의 그룹 분류대로 워크트리 내부에서 병렬 실행:
- 워크트리 경로: `tmp/worktree-group-{n}/`
- 각 워크트리에 적절한 에이전트 1~2개
- 머지는 변경량 적은 그룹부터

## Phase 4: 검증

```
Agent(tdd-author, model: "opus", prompt: "
모든 테스트 실행 (vitest run + playwright). 결과 보고.
- 통과: GREEN 확인
- 실패: 어떤 케이스가 왜 실패했는지
- 커버리지: 80% 미달 영역
")
```

테스트 실패면 Phase 3로 돌아가서 해당 도메인 에이전트에게 재작업 요청.

## Phase 5: 코드 리뷰

글로벌 `code-reviewer` 호출:

```
Agent(code-reviewer, model: "opus", prompt: "
[기능 변경 요약]
변경 파일: [목록]
CRITICAL/HIGH 이슈만 수정 필수. MEDIUM은 가능하면.
")
```

## Phase 6: 통합

- pre-commit hook으로 타입 체크 + 테스트 자동 실행
- 커밋 메시지: `feat:` / `fix:` / `refactor:` / `chore:` 컨벤션
- 통합 브랜치 머지 후 `tmp/TODO.md` 삭제

## 데이터 전달 프로토콜

- **태스크 기반**: `TaskCreate`/`TaskUpdate`로 진행 상태 공유
- **파일 기반**:
  - `tmp/TODO.md` — planner 산출물
  - `tmp/UX_*.md` — admin-ux-designer 산출물
  - `prisma/migrations/*` — db-architect 산출물
- **메시지 기반**: 팀원 간 직접 통신은 `SendMessage`로 (시그니처 합의 등)

## 에러 핸들링

| 상황 | 대응 |
|---|---|
| 테스트가 RED를 못 만들어냄 | tdd-author 재호출, 명세 정확도 점검 |
| 구현이 GREEN 못 만들어냄 (3회 이상) | 명세 모호함 의심 → 사용자 확인 |
| 마이그레이션 실패 | 즉시 사용자에게 보고, 자동 롤백 금지 |
| 빌드/타입 에러 | 글로벌 `build-error-resolver` 호출 |
| 보안 영향 의심 (인증/입력 검증) | 글로벌 `security-reviewer` 호출 |

## 도메인 에이전트 선택 가이드

| 변경 대상 | 호출 에이전트 |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/**` | `db-architect` |
| `app/admin/**` (입력 폼) | `admin-ux-designer` → `nextjs-implementer` → `ui-component-author` |
| `app/(public)/**` (공개 페이지) | `nextjs-implementer` + `ui-component-author` |
| `app/api/calendar/**` | `ical-engineer` |
| `components/ui/**` 또는 `app/globals.css` | `ui-component-author` |
| 인증/미들웨어 | `nextjs-implementer` + 글로벌 `security-reviewer` |

## 테스트 시나리오 (이 스킬 동작 검증용)

### 정상 흐름: 새 페이지 추가

요청: "공개 페이지에 밴드 상세 페이지(/band/[slug]) 추가해줘"

기대:
1. planner → light 트랙, 파일 ~4개
2. tdd-author → `band-detail.test.ts` + `e2e/band-detail.spec.ts` RED
3. nextjs-implementer → `app/(public)/band/[slug]/page.tsx` 작성
4. ui-component-author → 필요 시 `BandDetailHeader` 컴포넌트
5. tdd-author → GREEN 확인
6. code-reviewer → 리뷰

### 에러 흐름: 스키마 변경 마이그레이션 실패

요청: "Live에 status 필드 추가"

기대:
1. planner → 변경 파일 식별 (schema + 영향 받는 페이지)
2. tdd-author → 새 필드 검증 테스트 RED
3. db-architect → 스키마 변경
4. **마이그레이션 실패 시**: 자동 롤백 금지, 사용자에게 보고, drift 원인 분석 요청
5. 사용자 결정 후 재진행
