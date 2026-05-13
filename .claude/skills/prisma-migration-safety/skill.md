---
name: prisma-migration-safety
description: Prisma 마이그레이션 안전성 체크리스트. 컬럼 드롭/타입 변경/NOT NULL 추가/enum 제거 등 위험 변경을 감지하고 단계적 마이그레이션을 강제한다. schema.prisma 변경·`prisma migrate` 실행·운영 DB 변경 검토 시 트리거.
---

# prisma-migration-safety — 마이그레이션 안전성 체크

운영 DB는 데이터를 가지고 있다. 단순해 보이는 마이그레이션도 한 줄 실수로 컬럼/데이터를 날린다. 본 스킬은 위험 변경을 미리 식별하고 안전한 단계로 분리하는 가이드다.

## 위험도 분류

### 🔴 위험 (반드시 단계 분리)

| 변경 | 위험 | 안전 대안 |
|---|---|---|
| 컬럼 DROP | 데이터 영구 손실 | 코드에서 참조 제거 → 1릴리즈 후 DROP |
| 컬럼 RENAME | Prisma는 DROP+ADD로 처리, 데이터 손실 | 새 컬럼 ADD → 백필 → 코드 전환 → 옛 컬럼 DROP |
| 타입 변경 (e.g. `String → Int`) | 캐스팅 실패, 데이터 손실 | 새 컬럼 ADD → 변환 백필 → 코드 전환 → 옛 컬럼 DROP |
| NULL → NOT NULL | 기존 NULL row면 실패 | nullable ADD → 백필 → NOT NULL 강제 |
| Unique 제약 추가 | 중복 데이터 있으면 실패 | 중복 정리 → 제약 추가 |
| Enum 값 제거 | 기존 row가 해당 값 쓰면 실패 | 마이그레이션 SQL로 데이터 변환 후 제거 |
| 인덱스 추가 (대용량) | Prisma 기본은 락 — 운영 중 차단 | raw SQL `CREATE INDEX CONCURRENTLY` |

### 🟡 주의 (검토 후 진행)

- 외래키 추가 (참조 무결성 위반 시 실패)
- 외래키 onDelete 변경 (기존 동작 깨질 수 있음)
- 기본값 변경 (기존 row는 영향 없음, 신규만)
- 컬럼 ADD with NOT NULL + default (default가 없으면 위험)

### 🟢 안전

- nullable 컬럼 ADD
- enum 값 ADD
- 새 테이블/모델 ADD
- 컬럼 크기 확대 (e.g. `VARCHAR(50) → VARCHAR(200)`)
- 인덱스 추가 (소규모 테이블)
- 주석/문서 변경

## 단계 분리 패턴

### 패턴 1: NOT NULL 추가

```
Step 1 (release N): 컬럼 nullable로 추가
Step 2 (release N): 코드에서 값 항상 쓰도록 수정
Step 3 (release N+1, 운영 백필 후): NOT NULL로 변경
```

### 패턴 2: 컬럼 RENAME (Prisma 한계 우회)

```
Step 1: 새 컬럼 ADD (nullable)
Step 2: 양쪽에 쓰는 코드 배포
Step 3: SQL 백필 (UPDATE table SET new = old WHERE new IS NULL)
Step 4: 새 컬럼만 읽는 코드로 전환
Step 5: 옛 컬럼 DROP
```

### 패턴 3: Enum 값 제거

```
Step 1: 새 enum 값 ADD (대체 값)
Step 2: 데이터 변환 (UPDATE table SET col = '새값' WHERE col = '옛값')
Step 3: 코드에서 옛 값 참조 제거
Step 4: Prisma schema에서 옛 값 제거 + 마이그레이션
```

## Prisma 명령 사용 가이드

| 명령 | 환경 | 용도 |
|---|---|---|
| `prisma migrate dev` | 개발만 | 새 마이그레이션 작성 + 적용 |
| `prisma migrate deploy` | 운영/CI | 기존 마이그레이션 적용 |
| `prisma migrate reset` | 개발만 | DB 초기화 + 모든 마이그레이션 재적용 + 시드 |
| `prisma db push` | **금지** | 마이그레이션 없이 schema 강제 동기화 (위험) |
| `prisma migrate diff` | 검토 | 두 상태 간 SQL diff 확인 |

운영 환경에서는 `migrate deploy`만 사용한다.

## 작성 시 체크리스트

새 마이그레이션 작성 전에 다음을 모두 확인:

- [ ] schema.prisma 변경의 의도가 명확한가? (커밋 메시지로 설명 가능?)
- [ ] 위 "위험도 분류" 표 어느 분류인가?
- [ ] 위험이면 단계 분리 패턴 적용했는가?
- [ ] 영향받는 코드(쿼리, 타입, 컴포넌트)를 모두 식별했는가?
- [ ] 테스트 (특히 integration)가 업데이트되었는가?
- [ ] 기존 데이터로 마이그레이션 시뮬레이션해봤는가? (개발 DB에 운영 시드 채우고 dry-run)
- [ ] 롤백 계획이 있는가? (어떤 SQL로 되돌릴지)

## 마이그레이션 SQL 검토

`prisma migrate dev`가 생성한 `migration.sql`을 적용 전에 읽어본다. 자동 생성된 것이라도:

- 의도하지 않은 DROP이 있는지 확인 (특히 컬럼 rename의 경우)
- 인덱스 변경이 LOCK을 잡지 않는지
- 데이터 변환이 누락되지 않았는지

수정 필요하면 자동 생성된 SQL을 손으로 편집해도 된다 (Prisma는 SQL 파일을 그대로 적용함).

## 흔한 실수

1. **schema에서 모델/필드 이름 바꾸기** → Prisma는 RENAME 인식 못 함. DROP+ADD로 처리되어 데이터 손실. 위 패턴 2 사용.
2. **운영에서 `migrate dev` 실행** → 새 마이그레이션 만들어버림. drift 발생. 반드시 `deploy`.
3. **마이그레이션 파일 손으로 수정 후 push** → drift. `prisma migrate resolve`로 처리하거나 새 마이그레이션 추가.
4. **`db push`로 운영 변경** → 마이그레이션 히스토리 없음. 절대 금지.

## 트러블슈팅

- **drift 감지**: 운영 DB와 마이그레이션 히스토리 불일치. 원인 파악 (수동 변경? 다른 환경에서 push?) 후 `migrate resolve` 또는 baseline.
- **마이그레이션 적용 중 실패**: 트랜잭션이 부분 롤백됐는지 DB에 확인. `_prisma_migrations` 테이블에서 해당 row 상태 확인 후 수동 정리 가능.
- **개발 DB만 깨졌으면**: `prisma migrate reset` (개발에서만)

## 본 프로젝트 추가 규칙

- 모든 새 마이그레이션은 PR에서 사람 리뷰 1회 이상
- `prisma/migrations/*` 파일은 절대 사후 수정 금지 (이미 적용된 것)
- 운영은 아직 없지만, 처음부터 `migrate deploy` 사용 습관화
