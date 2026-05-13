---
name: tdd-vitest-playwright
description: 본 프로젝트의 테스트 작성 패턴. Vitest(unit/integration) + Playwright(E2E) + Prisma DB 격리 + 팩토리 + RHF/Zod 검증 테스트. 테스트 작성·DB 격리 셋업·E2E 시나리오·픽스처 팩토리 작성 시 트리거. "테스트", "test", "spec" 키워드 등장 시 참조.
---

# tdd-vitest-playwright — 테스트 패턴 가이드

본 프로젝트는 TDD 강제. 본 스킬은 Vitest + Playwright의 본 프로젝트 표준 패턴이다.

## 테스트 레이어

| 레이어 | 도구 | 위치 | 무엇을 |
|---|---|---|---|
| Unit | Vitest | `src/**/*.test.ts`, `lib/**/*.test.ts` | 순수 함수, Zod 스키마, 유틸 |
| Integration | Vitest | `**/*.integration.test.ts` | Server Action, Prisma 쿼리, API Route, 실제 DB |
| E2E | Playwright | `e2e/**/*.spec.ts` | 사용자 시나리오 |

## 디렉토리 컨벤션

```
test/
├─ factories/         ← 도메인 팩토리 (createLive, createBand, ...)
├─ helpers/           ← 공용 헬퍼 (resetDb, signInAsAdmin)
└─ fixtures/          ← 정적 픽스처 (샘플 iCal 결과 등)

e2e/
├─ admin/             ← 어드민 시나리오
├─ public/            ← 공개 페이지 시나리오
└─ calendar/          ← iCal 구독 시나리오
```

## Vitest 셋업

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
```

## DB 격리 전략

운영용 Postgres와 **별도 DB**(`girls_band_live_test`)를 docker-compose에서 동시 가동하거나, 같은 인스턴스에 별도 DB 생성. 권장: 같은 컨테이너 + 별도 DB.

각 테스트는 **트랜잭션 롤백** 또는 **테이블 truncate** 중 선택:

### 옵션 A: 트랜잭션 롤백 (빠름, 제한 있음)

- `beforeEach`에서 트랜잭션 시작, `afterEach`에서 롤백
- 단점: Prisma는 트랜잭션 내 다른 connection 못 봄 → Server Action 같은 게 별도 connection이면 안 됨

### 옵션 B: TRUNCATE (안전, 약간 느림)

- `beforeEach`에서 모든 테이블 `TRUNCATE ... RESTART IDENTITY CASCADE`
- Prisma 자동 생성: `await prisma.$executeRaw\`TRUNCATE TABLE x, y, z RESTART IDENTITY CASCADE\``

**본 프로젝트 권장: B (TRUNCATE)**. 정합성 우선.

`test/helpers/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

export const testDb = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
})

const TABLES = [
  'ticket_sale_tier', 'ticket_sale', 'ticket_tier',
  'live_format', 'live_band', 'live',
  'band', 'work', 'series', 'vendor',
]

export async function resetDb() {
  await testDb.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`
  )
}
```

`test/setup.ts`:

```ts
import { beforeEach, afterAll } from 'vitest'
import { resetDb, testDb } from './helpers/db'

beforeEach(async () => { await resetDb() })
afterAll(async () => { await testDb.$disconnect() })
```

## 팩토리 패턴

`test/factories/live.ts`:

```ts
import { testDb } from '../helpers/db'

export async function createLive(overrides: Partial<...> = {}) {
  const work = overrides.workId ? null : await createWork()
  const band = overrides.bandId ? null : await createBand({ workId: work!.id })
  return testDb.live.create({
    data: {
      slug: 'test-live-' + Date.now(),
      titleKo: '테스트 라이브',
      titleJp: 'テストライブ',
      type: 'SOLO',
      startAt: new Date('2026-08-15T10:00:00Z'),
      venueName: '테스트 회장',
      liveBands: band ? { create: { bandId: band.id, order: 1 } } : undefined,
      ...overrides,
    },
  })
}
```

규칙:
- 모든 필수 필드에 기본값
- 의존 엔티티 자동 생성 (overrides로 주입 가능)
- slug에 `Date.now()` 또는 cuid로 충돌 방지

## Server Action 테스트

```ts
import { describe, it, expect } from 'vitest'
import { createLiveAction } from '@/app/admin/lives/actions'
import { signInAsAdmin } from '@/test/helpers/auth'

describe('createLiveAction', () => {
  it('returns ok and creates a DRAFT live with default LIVE_VENUE format', async () => {
    await signInAsAdmin()
    const result = await createLiveAction({
      titleKo: '신규 라이브',
      titleJp: '新しいライブ',
      type: 'SOLO',
      startAt: '2026-09-01T19:00',
      venueName: '도쿄돔',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('DRAFT')
      // LIVE_VENUE 포맷이 자동 생성됐는지
      const formats = await testDb.liveFormat.findMany({ where: { liveId: result.data.id } })
      expect(formats).toHaveLength(1)
      expect(formats[0].type).toBe('LIVE_VENUE')
    }
  })

  it('returns errors for invalid input', async () => {
    const result = await createLiveAction({ titleKo: '' } as any)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBeDefined()
  })
})
```

## Zod 스키마 단위 테스트

```ts
import { describe, it, expect } from 'vitest'
import { liveHeaderSchema } from '@/lib/schemas/live'

describe('liveHeaderSchema', () => {
  it('accepts a valid live header', () => {
    const r = liveHeaderSchema.safeParse({ ... })
    expect(r.success).toBe(true)
  })

  it('rejects empty title', () => {
    const r = liveHeaderSchema.safeParse({ titleKo: '', ... })
    expect(r.success).toBe(false)
  })
})
```

## Playwright E2E

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,  // DB 공유라서 직렬
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Tokyo',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev:test',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

E2E 시작 전: `prisma migrate reset --force` (테스트 DB) + 어드민 비밀번호 시드.

### E2E 예시 (어드민 Live 등록 흐름)

```ts
test('어드민이 새 라이브를 등록하고 공개한다', async ({ page }) => {
  await page.goto('/admin/login')
  await page.fill('input[name=password]', process.env.ADMIN_PASSWORD!)
  await page.click('button[type=submit]')

  await page.goto('/admin/lives/new')
  await page.fill('input[name=titleKo]', '신규 라이브')
  // ... 헤더 저장
  await expect(page).toHaveURL(/\/admin\/lives\/\d+$/)

  // 섹션별 추가
  await page.click('text=출연 밴드 추가')
  // ...

  await page.click('text=공개')
  await expect(page.getByText('공개됨')).toBeVisible()

  // 공개 페이지에서 확인
  await page.goto('/live/...')
  await expect(page.getByRole('heading', { name: '신규 라이브' })).toBeVisible()
})
```

## iCal 테스트 패턴

피드는 텍스트라 string assertion 가능:

```ts
it('VCALENDAR 래퍼와 VEVENT 1개 포함', async () => {
  const res = await fetch('/api/calendar/all.ics')
  const body = await res.text()
  expect(body).toMatch(/^BEGIN:VCALENDAR\r\n/)
  expect(body).toMatch(/\r\nEND:VCALENDAR\r\n?$/)
  expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThan(0)
  // 줄 폴딩 (CRLF + 공백) 형식 검증
  expect(body).not.toMatch(/[^\r]\n/)
})
```

## 모킹 가이드

| 대상 | 처리 |
|---|---|
| Prisma | 모킹 금지 (실제 DB 사용) |
| Server Action 내부 | 모킹 금지 (블랙박스 테스트) |
| MinIO | 모킹 (테스트용 stub) |
| 외부 API | 모킹 |
| 시각 | `vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))` 로 고정 |

## RED 검증

테스트 작성 후 반드시:

```bash
pnpm vitest run path/to/new.test.ts
```

→ 실패 로그 출력 확인. 통과해버리면 테스트가 약하거나 이미 구현돼 있는 것.

## 커버리지

```bash
pnpm vitest run --coverage
```

80% 미달 영역은 RED 추가. 가공 코드(generated, migrations)는 제외 (`vitest.config.ts`의 `coverage.exclude`).

## 흔한 실수

- 트랜잭션 격리 쓰고 Server Action 호출 → 별도 connection이라 안 보임. TRUNCATE 사용.
- E2E에서 시각 고정 안 함 → "다가오는 라이브" 표시가 시간에 따라 깨짐. `clock.install()`로 고정.
- 테스트 간 데이터 누수 → setup의 resetDb 누락. `beforeEach`에서 명시.
