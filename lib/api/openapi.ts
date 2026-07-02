/**
 * 공개 API v1 OpenAPI 3.1 문서 (정적 객체).
 *
 * ponytail: zod-to-openapi 등 의존성 추가 없이 손으로 작성한 정적 스펙.
 *   - 필드/타입/status 는 lib/api/schemas.ts, app/api/v1/**\/route.ts,
 *     prisma/schema.prisma(Live/Band) 와 100% 일치시킨다.
 *   - 스키마가 바뀌면 이 파일도 함께 갱신해야 한다(수동 동기화).
 *
 * 시각 규칙: 모든 datetime 입출력은 UTC ISO 8601 (예: 2026-07-02T12:00:00Z). JST 아님.
 */

/** OpenAPI 3.1 nullable 표기 헬퍼: type 배열에 "null" 을 더한다. */
const nullable = (type: string, extra: Record<string, unknown> = {}) => ({
  type: [type, "null"],
  ...extra,
});

const dateTime = { type: "string", format: "date-time" } as const;
const nullableDateTime = { type: ["string", "null"], format: "date-time" } as const;

const liveType = {
  type: "string",
  enum: ["SOLO", "TAIBAN", "FES"],
  description: "SOLO=단독, TAIBAN=대반, FES=페스",
} as const;

const workSchema = {
  type: "object",
  description: "Band 의 부모 작품. GET /api/v1/bands 목록 응답에만 포함된다.",
  properties: {
    id: { type: "integer" },
    seriesId: nullable("integer"),
    slug: { type: "string" },
    nameKo: { type: "string" },
    nameJp: { type: "string" },
    nameEn: nullable("string"),
    kind: nullable("string"),
    logoUrl: nullable("string"),
    description: nullable("string"),
    createdAt: dateTime,
    updatedAt: dateTime,
  },
} as const;

const liveSchema = {
  type: "object",
  description: "라이브 공연 1건. datetime 필드는 UTC ISO 8601.",
  properties: {
    id: { type: "integer" },
    slug: { type: "string" },
    tourId: nullable("integer"),
    titleKo: { type: "string" },
    titleJp: { type: "string" },
    titleEn: nullable("string"),
    type: liveType,
    startAt: { ...dateTime, description: "개연 (UTC)" },
    doorsOpenAt: { ...nullableDateTime, description: "개장 (UTC)" },
    endAt: { ...nullableDateTime, description: "종료 추정 (UTC)" },
    venueName: { type: "string" },
    venueAddress: nullable("string"),
    venueUrl: nullable("string"),
    officialUrls: {
      ...nullable("array", { items: { type: "string" } }),
      description: "공식 URL 배열. API 로는 설정 불가(응답 전용).",
    },
    posterUrl: nullable("string"),
    thumbnailUrl: nullable("string"),
    ticketRestrictions: {
      ...nullable("string"),
      description: "매수제한/본인확인 자유 텍스트. API 로는 설정 불가(응답 전용).",
    },
    notes: nullable("string"),
    status: {
      type: "string",
      enum: ["DRAFT", "PUBLISHED"],
      description: "API 로 생성 시 항상 DRAFT.",
    },
    deletedAt: nullableDateTime,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: [
    "id",
    "slug",
    "titleKo",
    "titleJp",
    "type",
    "startAt",
    "venueName",
    "status",
    "createdAt",
    "updatedAt",
  ],
} as const;

const bandSchema = {
  type: "object",
  description: "밴드. GET 목록 응답에는 `work` 가 포함되고, 단건/생성 응답에는 없다.",
  properties: {
    id: { type: "integer" },
    workId: { type: "integer" },
    slug: { type: "string" },
    nameKo: { type: "string" },
    nameJp: { type: "string" },
    nameEn: nullable("string"),
    officialUrl: nullable("string"),
    snsLinks: {
      ...nullable("object", { additionalProperties: { type: "string" } }),
      description: "SNS 링크 맵 (예: { twitter: 'https://...' }).",
    },
    imageUrl: nullable("string"),
    description: nullable("string"),
    work: workSchema,
    createdAt: dateTime,
    updatedAt: dateTime,
  },
  required: [
    "id",
    "workId",
    "slug",
    "nameKo",
    "nameJp",
    "createdAt",
    "updatedAt",
  ],
} as const;

const createLiveInput = {
  type: "object",
  properties: {
    slug: { type: "string", minLength: 1 },
    titleKo: { type: "string", minLength: 1 },
    titleJp: { type: "string", minLength: 1 },
    titleEn: nullable("string"),
    type: liveType,
    startAt: { ...dateTime, description: "UTC ISO 8601" },
    doorsOpenAt: nullableDateTime,
    endAt: nullableDateTime,
    venueName: { type: "string", minLength: 1 },
    venueAddress: nullable("string"),
    venueUrl: nullable("string"),
    posterUrl: nullable("string"),
    thumbnailUrl: nullable("string"),
    notes: nullable("string"),
    tourId: nullable("integer"),
  },
  required: ["slug", "titleKo", "titleJp", "type", "startAt", "venueName"],
  additionalProperties: false,
} as const;

const updateLiveInput = {
  type: "object",
  description: "부분 수정. createLiveInput 의 모든 필드가 optional.",
  properties: createLiveInput.properties,
  additionalProperties: false,
} as const;

const createBandInput = {
  type: "object",
  properties: {
    workId: { type: "integer" },
    slug: { type: "string", minLength: 1 },
    nameKo: { type: "string", minLength: 1 },
    nameJp: { type: "string", minLength: 1 },
    nameEn: nullable("string"),
    officialUrl: nullable("string"),
    imageUrl: nullable("string"),
    description: nullable("string"),
    snsLinks: nullable("object", { additionalProperties: { type: "string" } }),
  },
  required: ["workId", "slug", "nameKo", "nameJp"],
  additionalProperties: false,
} as const;

const errorSchema = {
  type: "object",
  description:
    "에러 응답. validation_error 일 때만 issues 가 함께 온다.",
  properties: {
    error: {
      type: "string",
      description: "'unauthorized' | 'validation_error' | 'not_found'",
    },
    issues: {
      type: "array",
      description: "validation_error(422) 일 때만 존재.",
      items: {
        type: "object",
        properties: {
          path: { type: "string" },
          message: { type: "string" },
        },
        required: ["path", "message"],
      },
    },
  },
  required: ["error"],
} as const;

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const unauthorizedRes = errorResponse("API 키 누락/오류/폐기 → { error: 'unauthorized' }");
const validationRes = errorResponse(
  "검증 실패 → { error: 'validation_error', issues: [...] }"
);
const notFoundRes = errorResponse("리소스 미존재 → { error: 'not_found' }");
const conflictRes = errorResponse(
  "중복 slug / 존재하지 않는 workId → { error: '<사유>' }"
);

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer" },
} as const;

const jsonBody = (ref: string) => ({
  required: true,
  content: { "application/json": { schema: { $ref: ref } } },
});

const jsonRes = (description: string, ref: string) => ({
  description,
  content: { "application/json": { schema: { $ref: ref } } },
});

const arrayRes = (description: string, ref: string) => ({
  description,
  content: {
    "application/json": {
      schema: { type: "array", items: { $ref: ref } },
    },
  },
});

/** OpenAPI 3.1 문서 객체. */
export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "girls_band_live 공개 API",
    version: "1.0.0",
    description:
      "라이브/밴드 등록·조회 공개 API. 모든 datetime 은 UTC ISO 8601. " +
      "인증은 X-API-Key 헤더(모든 엔드포인트 필수).",
  },
  servers: [{ url: "/api/v1", description: "기본 경로" }],
  security: [{ apiKey: [] }],
  paths: {
    "/lives": {
      get: {
        operationId: "listLives",
        summary: "라이브 목록",
        tags: ["lives"],
        responses: {
          "200": arrayRes("라이브 배열", "#/components/schemas/Live"),
          "401": unauthorizedRes,
        },
      },
      post: {
        operationId: "createLive",
        summary: "라이브 생성 (status=DRAFT)",
        tags: ["lives"],
        requestBody: jsonBody("#/components/schemas/CreateLiveInput"),
        responses: {
          "201": jsonRes("생성된 라이브", "#/components/schemas/Live"),
          "401": unauthorizedRes,
          "422": validationRes,
        },
      },
    },
    "/lives/{id}": {
      get: {
        operationId: "getLive",
        summary: "라이브 단건",
        tags: ["lives"],
        parameters: [idParam],
        responses: {
          "200": jsonRes("라이브", "#/components/schemas/Live"),
          "401": unauthorizedRes,
          "404": notFoundRes,
        },
      },
      patch: {
        operationId: "updateLive",
        summary: "라이브 부분 수정",
        tags: ["lives"],
        parameters: [idParam],
        requestBody: jsonBody("#/components/schemas/UpdateLiveInput"),
        responses: {
          "200": jsonRes("수정된 라이브", "#/components/schemas/Live"),
          "401": unauthorizedRes,
          "404": notFoundRes,
          "409": conflictRes,
          "422": validationRes,
        },
      },
    },
    "/bands": {
      get: {
        operationId: "listBands",
        summary: "밴드 목록 (work 포함)",
        tags: ["bands"],
        responses: {
          "200": arrayRes("밴드 배열 (각 항목에 work 포함)", "#/components/schemas/Band"),
          "401": unauthorizedRes,
        },
      },
      post: {
        operationId: "createBand",
        summary: "밴드 생성",
        tags: ["bands"],
        requestBody: jsonBody("#/components/schemas/CreateBandInput"),
        responses: {
          "201": jsonRes("생성된 밴드 (work 미포함)", "#/components/schemas/Band"),
          "401": unauthorizedRes,
          "409": conflictRes,
          "422": validationRes,
        },
      },
    },
    "/bands/{id}": {
      get: {
        operationId: "getBand",
        summary: "밴드 단건 (work 미포함)",
        tags: ["bands"],
        parameters: [idParam],
        responses: {
          "200": jsonRes("밴드 (work 미포함)", "#/components/schemas/Band"),
          "401": unauthorizedRes,
          "404": notFoundRes,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description: "발급된 평문 API 키 (gbl_... 포맷).",
      },
    },
    schemas: {
      Live: liveSchema,
      Band: bandSchema,
      CreateLiveInput: createLiveInput,
      UpdateLiveInput: updateLiveInput,
      CreateBandInput: createBandInput,
      Error: errorSchema,
    },
  },
} as const;

export function getOpenApiDocument() {
  return openApiDocument;
}
