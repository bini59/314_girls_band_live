# 공개 API v1

girls_band_live 의 라이브/밴드 등록·조회 공개 API 문서.

- **Base URL**: `https://<your-domain>/api/v1` (로컬 개발 `http://localhost:3000/api/v1`)
- **OpenAPI 스펙**: [`/api/v1/openapi.json`](/api/v1/openapi.json) (인증 불필요, 정적 캐시)
- **LLM 요약**: [`/llms.txt`](/llms.txt)

## 인증

모든 엔드포인트는 `X-API-Key` 헤더가 필수다.

- 키 발급: 어드민 `/admin/api-keys` 에서 생성한다. 발급 시 1회만 노출되는 평문(`gbl_` 접두)을 저장해 두어야 한다.
- 헤더에는 평문 키를 그대로 넣는다: `X-API-Key: gbl_xxxxxxxxxxxx`

```bash
curl https://<your-domain>/api/v1/lives -H "X-API-Key: gbl_xxxxxxxxxxxx"
```

## 시각 규칙

모든 datetime 입출력은 **UTC ISO 8601** 이다 (예: `2026-07-02T12:00:00Z`). JST(일본 시각)가 아니다. 요청 body 의 `startAt` 등도 UTC 로 보내야 하며, 응답의 datetime 필드도 UTC 로 직렬화된다. (어드민 UI 는 JST 로 표시하지만 API 경계는 순수 UTC.)

## 에러 코드

| Status | body | 발생 조건 |
|---|---|---|
| 401 | `{ "error": "unauthorized" }` | `X-API-Key` 누락 / 잘못됨 / 폐기된 키 |
| 422 | `{ "error": "validation_error", "issues": [{ "path": "...", "message": "..." }] }` | 요청 body 검증 실패 |
| 404 | `{ "error": "not_found" }` | `{id}` 리소스 미존재 (또는 id 가 정수가 아님) |

`issues[].path` 는 실패한 필드 경로(점 구분), `message` 는 Zod 검증 메시지다.

---

## 라이브 (Lives)

### GET /lives — 목록

`updatedAt` 내림차순, 최대 50건. `Live` 배열을 반환한다.

```bash
curl https://<your-domain>/api/v1/lives -H "X-API-Key: gbl_xxxxxxxxxxxx"
```

```json
[
  {
    "id": 1,
    "slug": "mygo-fes-2026",
    "tourId": null,
    "titleKo": "마이고 페스 2026",
    "titleJp": "MyGO!!!!! FES 2026",
    "titleEn": null,
    "type": "FES",
    "startAt": "2026-07-02T10:00:00.000Z",
    "doorsOpenAt": null,
    "endAt": null,
    "venueName": "Nippon Budokan",
    "venueAddress": null,
    "venueUrl": null,
    "officialUrls": null,
    "posterUrl": null,
    "thumbnailUrl": null,
    "ticketRestrictions": null,
    "notes": null,
    "status": "DRAFT",
    "deletedAt": null,
    "createdAt": "2026-07-01T09:00:00.000Z",
    "updatedAt": "2026-07-01T09:00:00.000Z"
  }
]
```

### POST /lives — 생성

성공 시 `201` 과 생성된 `Live`. 새 라이브는 항상 `status: "DRAFT"` 로 생성된다. `slug` 가 충돌하면 서버가 `-2`, `-3` 접미사를 자동으로 붙인다.

**필수**: `slug`, `titleKo`, `titleJp`, `type`(`SOLO` | `TAIBAN` | `FES`), `startAt`(UTC ISO), `venueName`
**선택**: `titleEn`, `doorsOpenAt`(UTC ISO), `endAt`(UTC ISO), `venueAddress`, `venueUrl`, `posterUrl`, `thumbnailUrl`, `notes`, `tourId`(int)

> `officialUrls`, `ticketRestrictions`, `status` 는 API 로 설정할 수 없다(응답 전용 / 서버 관리).

```bash
curl -X POST https://<your-domain>/api/v1/lives \
  -H "X-API-Key: gbl_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "mygo-fes-2026",
    "titleKo": "마이고 페스 2026",
    "titleJp": "MyGO!!!!! FES 2026",
    "type": "FES",
    "startAt": "2026-07-02T10:00:00Z",
    "venueName": "Nippon Budokan"
  }'
```

검증 실패 예시 (`422`):

```json
{
  "error": "validation_error",
  "issues": [
    { "path": "type", "message": "Invalid enum value. Expected 'SOLO' | 'TAIBAN' | 'FES', received 'LIVE'" },
    { "path": "startAt", "message": "Invalid datetime" }
  ]
}
```

### GET /lives/{id} — 단건

성공 `200` `Live`, 미존재 `404`.

```bash
curl https://<your-domain>/api/v1/lives/1 -H "X-API-Key: gbl_xxxxxxxxxxxx"
```

### PATCH /lives/{id} — 부분 수정

`POST /lives` 의 모든 필드가 optional. 보낸 필드만 갱신된다. 성공 `200` `Live`, 미존재 `404`, 검증 실패 `422`.

```bash
curl -X PATCH https://<your-domain>/api/v1/lives/1 \
  -H "X-API-Key: gbl_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{ "venueName": "Tokyo Dome", "endAt": "2026-07-02T13:00:00Z" }'
```

---

## 밴드 (Bands)

### GET /bands — 목록

`nameKo` 오름차순. 각 항목에 부모 작품(`work`)이 **포함**된다.

```bash
curl https://<your-domain>/api/v1/bands -H "X-API-Key: gbl_xxxxxxxxxxxx"
```

```json
[
  {
    "id": 1,
    "workId": 1,
    "slug": "mygo",
    "nameKo": "마이고",
    "nameJp": "MyGO!!!!!",
    "nameEn": null,
    "officialUrl": null,
    "snsLinks": { "twitter": "https://twitter.com/mygo" },
    "imageUrl": null,
    "description": null,
    "work": {
      "id": 1,
      "seriesId": null,
      "slug": "bang-dream",
      "nameKo": "뱅드림",
      "nameJp": "BanG Dream!",
      "nameEn": null,
      "kind": "media_mix",
      "logoUrl": null,
      "description": null,
      "createdAt": "2026-06-01T00:00:00.000Z",
      "updatedAt": "2026-06-01T00:00:00.000Z"
    },
    "createdAt": "2026-06-01T00:00:00.000Z",
    "updatedAt": "2026-06-01T00:00:00.000Z"
  }
]
```

### POST /bands — 생성

성공 `201` `Band` (**`work` 미포함**).

**필수**: `workId`(int), `slug`, `nameKo`, `nameJp`
**선택**: `nameEn`, `officialUrl`, `imageUrl`, `description`, `snsLinks`(object: string→string)

`workId` 가 존재하지 않거나 `slug` 가 중복이면 서버 에러가 전파된다.

```bash
curl -X POST https://<your-domain>/api/v1/bands \
  -H "X-API-Key: gbl_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "workId": 1,
    "slug": "mygo",
    "nameKo": "마이고",
    "nameJp": "MyGO!!!!!",
    "snsLinks": { "twitter": "https://twitter.com/mygo" }
  }'
```

### GET /bands/{id} — 단건

성공 `200` `Band` (**`work` 미포함**), 미존재 `404`.

```bash
curl https://<your-domain>/api/v1/bands/1 -H "X-API-Key: gbl_xxxxxxxxxxxx"
```
