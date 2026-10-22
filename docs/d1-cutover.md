# D1 / Workers 전환

이 문서는 운영자가 실행할 절차다. 이 PR에서는 로컬 D1만 사용한다.
`database_id`는 자리표시자이며, 기존 Docker 배포와 Workers 배포는 모두 수동 실행이다.
운영 Postgres와 기존 이미지는 롤백 기간 동안 보존한다. D1 초기 마이그레이션을 Postgres에 적용하지 않는다.

## Worker Wasm 번들링과 검증

Prisma의 query compiler Wasm을 webpack의 일반 Wasm 로더로 처리하면 Node `fs`로
`/bundle/static/wasm/...`을 읽게 되어 Worker의 첫 DB 요청이 ENOENT로 실패한다.
production 서버 빌드에서는 `.wasm?module` import를 webpack external import로 유지한다.
OpenNext가 이 경로를 Wrangler에 넘기고, Wrangler가 Wasm을 Worker 모듈로 포함한다.
Node에서 실행하는 `next dev`는 동일 스키마의 Node용 생성 클라이언트로 치환한다. D1 adapter와 로컬 D1 바인딩은 동일하다.
Node용 생성 클라이언트는 Playwright의 CommonJS 로더와 호환되도록 `moduleFormat = "cjs"`로 생성한다.
Next 15 / Prisma 7 / OpenNext 버전은 그대로 유지한다.

`pnpm test:worker`는 임시 디렉터리의 로컬 D1에 마이그레이션과 fixture를 적용하고 빌드된 Worker를 실행한다.
홈페이지·상세 반복 조회, 인증된 API 생성/수정/조회, UTC 날짜 round trip을 검증한다.
테스트 후 Worker와 임시 DB를 삭제하며 개발 DB나 운영 리소스에 접근하지 않는다. CI에서도 같은 검증을 수행한다.

측정: minify를 켠 `wrangler deploy --dry-run`에서 9682.35 KiB (gzip 2939.33 KiB, 약 2.87 MiB).
무료 3 MiB / 유료 10 MiB gzip 한도 이내다. 빌드 산출물만 측정했으며 업로드하지 않았다.
이전 2086.90 KiB 측정치는 Wasm이 빠진 불완전한 번들이었다. `wrangler.jsonc`의 `minify: true`를 유지한다.

Prisma 7.8.0 / Next 15.5.28 / OpenNext 1.14.8을 사용한다.
최신 OpenNext 1.20.12는 Next 15 지원 종료 검사로 빌드를 거부해 Next 15 호환 버전으로 고정했다.
ARM64 빌드에서 ast-grep 0.40.0의 `le16toh` 심볼 로딩 오류가 있어 0.41.0으로 override했다.
Prisma CLI diff는 명시적 로컬 datasource URL이 없을 때 SQL 없이 종료하므로 CLI 설정에 사용하지 않는 file URL을 명시했다.

## 개발 / 검증

Node 22.12+ / pnpm 9. `pnpm install`, `pnpm prisma:generate`, `pnpm prisma:migrate`, `pnpm dev`.
DB는 `.wrangler/state`의 로컬 D1이다. `DATABASE_URL`과 Docker DB는 사용하지 않는다.
`pnpm test:run`은 Miniflare/workerd D1을 테스트 파일마다 새로 만들고 SQL 마이그레이션을 적용한다.
`pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `python3 scripts/export-postgres.test.py`.
Worker: `pnpm build:worker`, `pnpm test:worker` (임시 로컬 D1).
개발 DB로 수동 확인: `pnpm exec wrangler dev --local`.
번들 측정만: `pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry-run` (업로드하지 않음).

Prisma 7의 `prisma-client`는 enum을 TS 타입/상수로 유지하며 SQLite에는 TEXT로 저장한다.
초기 SQL의 JSON 컬럼은 Prisma가 생성한 JSONB 별칭 대신 TEXT affinity를 명시했다.
JSON은 JSON 텍스트로 저장하며 `Prisma.DbNull`과 `Prisma.JsonNull`을 구분한다.
UTC 날짜는 Prisma D1 어댑터가 바인딩하는 ISO 텍스트(`2026-10-01T09:00:00.000+00:00`)로 저장한다.
직접 SQL(`lib/d1.ts`)과 import도 같은 형식을 쓴다. SQLite는 정수와 텍스트를 비교하면 항상 정수가 작다고 보므로
epoch 정수가 섞이면 Prisma의 날짜 범위 조회에서 해당 행이 빠진다. UI는 JST 유지.
SQLite LIKE는 비 ASCII 대소문자를 접지 않으므로 검색은 `lib/search.ts`에서 NFC 정규화와 Unicode 소문자 변환으로 일치 ID를 구한다. 이 ID 조건에 기존 필터·정렬·페이지네이션·count를 적용한다. 검색 시 해당 테이블의 ID와 검색 문자열 컬럼을 읽으므로 데이터 증가 시 정규화 검색 인덱스를 검토한다.
앱에서 jsonb 연산자, PG 배열, raw RETURNING 의존은 없었다. D1 INSERT RETURNING과 FK/cascade는 테스트한다.

## 브라우저 E2E 결과

전체 `pnpm test:e2e` 실행은 8 passed / 9 failed / 3 skipped였다.
실패는 중복 heading/text locator, Playwright에 없는 `getByDisplayValue`, `selectOption` 인수,
테스트 간 잔여 데이터에 대한 빈 목록 기대, 메뉴/상태 문자열 기대 등이다.
Wasm 로딩 오류와 개발 서버 기동 문제는 해결했지만 전체 UI E2E가 green인 상태는 아니다.
Worker DB 스모크와 D1 원자성 통합 테스트는 별도로 검증하며, 운영 전환 전 UI 수동 확인은 아래 runbook을 따른다.

## 원자적 쓰기

Prisma D1 어댑터의 `$transaction`은 사용하지 않는다.
판매 생성/수정/티어 교체, 밴드/티어 재정렬은 읽기로 소속을 검증한 뒤 D1 `batch()`로 쓰기를 묶는다.
판매 생성의 ID는 batch 첫 INSERT RETURNING으로 받고, 연결은 같은 batch의 단일 INSERT SELECT에서
`last_insert_rowid()`를 사용한다. 조회로 max(id)를 계산하지 않는다.
중복 티어 PK 실패와 두 번째 재정렬 UPDATE의 trigger 실패로 앞선 쓰기까지 롤백되는지 테스트한다.
읽기 검증과 batch 사이에는 트랜잭션이 없으므로 FK 검사는 batch에서도 DB가 강제한다.

## 운영 전환 (운영자만 실행)

1. 현재 운영 이미지 SHA, DB 백업, 라우팅 설정을 기록한다. 어드민/API 쓰기를 중지해 이중 쓰기를 막는다.
2. Cloudflare에서 D1을 생성하고 실제 ID로 `wrangler.jsonc`를 설정한다. `DB` 바인딩 이름은 유지한다.
   Workers 및 GitHub의 계정/토큰과 SSO 환경 설정은 운영자가 준비한다.
   `AUTH_ORIGIN`, `CLIENT_ID`, `APP_ORIGIN`, `AUTH_REQUIRED_ROLE`, `APP_SECRET`을 Worker에 설정한다.
   secret은 저장소에 넣지 않는다. SSO `/verify` 장애 시 fail-closed인지 확인한다.
3. `wrangler d1 migrations apply DB --remote`로 빈 D1에 스키마를 만든다.
4. 운영자가 Postgres에 접속 가능한 환경에서 한 번의 읽기 전용 repeatable-read snapshot을 만든다:

   ```bash
   umask 077
   # PGHOST/PGUSER/PGDATABASE/PGPASSWORD 등은 운영자가 별도로 설정한다.
   psql -X -qAt -v ON_ERROR_STOP=1 -f scripts/export-postgres.sql > snapshot.json
   python3 scripts/export-postgres.py < snapshot.json > import.sql
   ```

   export는 enum 문자열, JSON/SQL NULL, UTC 날짜, 원래 ID/API 키 해시를 보존한다.
   이 파일들은 민감한 데이터이므로 커밋하지 않는다. 출력 파일을 검토하고 먼저 별도 로컬 D1에서 검증한다.
   빈 DB에만 import한다. 재실행이 필요하면 새 DB를 만들고 다시 시작한다.
5. 운영자가 `wrangler d1 execute DB --remote --file import.sql`을 실행한다.
   테이블별 행 수/ID, JOIN 관계, UTC 날짜, JSON, `PRAGMA foreign_key_check` 결과를 원본과 대조한다.
   명시적 ID INSERT는 SQLite AUTOINCREMENT sequence를 갱신하므로 다음 생성 ID가 기존 최대보다 큰지 확인한다.
6. `pnpm build:worker`와 bundle dry-run 결과가 플랜 한도(무료 3 MB, 유료 10 MB gzip)에 맞는지 확인한다.
   수동 Workers workflow를 실행한다. 기존 Docker Deploy workflow를 새 코드로 실행하지 않는다.
7. 운영자가 라우팅을 전환한다. 공개 목록/상세/iCal/API 키/관리자 SSO/판매 생성과 수정/티어 및 라인업 정렬을 확인한다.
   UTC 저장·JST 표시, 다른 라이브 티어 거부, 로그 오류와 5xx를 확인한 뒤 쓰기를 재개한다.

## 롤백

쓰기 재개 전 실패: Worker 라우팅을 기존 서비스로 되돌리고 기록한 Postgres 이미지 SHA를 사용한다.
기존 DB/볼륨을 삭제하지 않는다. legacy 배포가 필요하면 전환 전 커밋의 workflow/compose를 사용한다.
쓰기 재개 후 실패: 우선 쓰기를 멈추고 D1 snapshot을 보존한다. D1에서 추가된 변경을 Postgres로 대조·반영한 후
기존 서비스로 전환한다. 이 PR은 역방향 데이터 동기화를 자동화하지 않으므로 바로 라우팅만 되돌리면 새 데이터를 잃는다.
