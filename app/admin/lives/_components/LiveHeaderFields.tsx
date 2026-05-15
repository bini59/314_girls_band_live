"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThumbnailField } from "@/components/admin/ThumbnailField";

/**
 * 라이브 헤더 폼 필드의 공용 controlled 컴포넌트.
 *
 * 신규 등록(`NewLiveForm`) 과 자동저장(`LiveHeaderSection`) 양쪽에서 동일한
 * 필드 구성을 공유하기 위해 추출.
 *
 * - values: 현재 폼 값
 * - onChange: 필드 변경 콜백 (key, value)
 * - errors: 필드별 에러 배열 (zod flatten 결과)
 * - slugMode: 'required' | 'optional' | 'readonly'
 *     · required: 신규 폼 (직접 입력 또는 titleEn 자동 생성)
 *     · optional: 자동저장 폼 (필수 표시 유지)
 *     · readonly: slug 변경 금지 (다른 영역에서만 사용)
 * - includeNotes: 신규 폼은 메모(textarea) 포함, 자동저장 섹션은 미포함
 */
export interface LiveHeaderFieldValues {
  titleKo?: string;
  titleJp?: string;
  titleEn?: string;
  type?: "SOLO" | "TAIBAN" | "FES";
  startAtJst?: string;
  doorsOpenAtJst?: string;
  endAtJst?: string;
  venueName?: string;
  venueAddress?: string;
  venueUrl?: string;
  posterUrl?: string;
  thumbnailUrl?: string;
  slug?: string;
  notes?: string;
}

export type LiveHeaderFieldErrors = Partial<
  Record<keyof LiveHeaderFieldValues, string[]>
>;

export interface LiveHeaderFieldsProps {
  values: LiveHeaderFieldValues;
  onChange: <K extends keyof LiveHeaderFieldValues>(
    key: K,
    value: LiveHeaderFieldValues[K]
  ) => void;
  errors?: LiveHeaderFieldErrors;
  /** slug 필드 표시 모드. */
  slugMode?: "required" | "optional" | "readonly";
  /** 메모(notes) textarea 포함 여부. */
  includeNotes?: boolean;
}

export function LiveHeaderFields({
  values,
  onChange,
  errors = {},
  slugMode = "required",
  includeNotes = false,
}: LiveHeaderFieldsProps): React.JSX.Element {
  const slugRequired = slugMode === "required";
  const slugReadonly = slugMode === "readonly";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FieldGroup
        label="제목 (한국어)"
        name="titleKo"
        value={values.titleKo ?? ""}
        onChange={(v) => onChange("titleKo", v)}
        error={errors.titleKo}
        required
        placeholder="MyGO!!!!! 1주년 라이브"
      />
      <FieldGroup
        label="제목 (일본어)"
        name="titleJp"
        value={values.titleJp ?? ""}
        onChange={(v) => onChange("titleJp", v)}
        error={errors.titleJp}
        required
        placeholder="MyGO!!!!! 1st ライブ「春の唄」"
      />
      <FieldGroup
        label="제목 (영어)"
        name="titleEn"
        value={values.titleEn ?? ""}
        onChange={(v) => onChange("titleEn", v)}
        error={errors.titleEn}
        placeholder="MyGO!!!!! 1st Live"
      />

      <div className="flex flex-col gap-1">
        <Label htmlFor="type">
          타입 <span className="text-[color:var(--color-destructive)]">*</span>
        </Label>
        <select
          id="type"
          name="type"
          value={values.type ?? "SOLO"}
          onChange={(e) =>
            onChange("type", e.target.value as "SOLO" | "TAIBAN" | "FES")
          }
          className="flex h-10 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2 text-sm text-[color:var(--color-foreground)]"
        >
          <option value="SOLO">SOLO (단독)</option>
          <option value="TAIBAN">TAIBAN (대반)</option>
          <option value="FES">FES (페스)</option>
        </select>
        <FieldError messages={errors.type} />
      </div>

      <FieldGroup
        label="개연 (JST)"
        name="startAtJst"
        type="datetime-local"
        value={values.startAtJst ?? ""}
        onChange={(v) => onChange("startAtJst", v)}
        error={errors.startAtJst}
        required
      />
      <FieldGroup
        label="개장"
        name="doorsOpenAtJst"
        type="datetime-local"
        value={values.doorsOpenAtJst ?? ""}
        onChange={(v) => onChange("doorsOpenAtJst", v)}
        error={errors.doorsOpenAtJst}
      />
      <FieldGroup
        label="종료(추정)"
        name="endAtJst"
        type="datetime-local"
        value={values.endAtJst ?? ""}
        onChange={(v) => onChange("endAtJst", v)}
        error={errors.endAtJst}
      />

      <FieldGroup
        label="장소"
        name="venueName"
        value={values.venueName ?? ""}
        onChange={(v) => onChange("venueName", v)}
        error={errors.venueName}
        required
        placeholder="さいたまスーパーアリーナ"
      />
      <FieldGroup
        label="주소"
        name="venueAddress"
        value={values.venueAddress ?? ""}
        onChange={(v) => onChange("venueAddress", v)}
        error={errors.venueAddress}
        placeholder="埼玉県さいたま市中央区新都心8"
      />
      <FieldGroup
        label="장소 URL"
        name="venueUrl"
        type="url"
        value={values.venueUrl ?? ""}
        onChange={(v) => onChange("venueUrl", v)}
        error={errors.venueUrl}
        placeholder="https://..."
      />

      <FieldGroup
        label="Slug"
        name="slug"
        value={values.slug ?? ""}
        onChange={(v) => onChange("slug", v)}
        error={errors.slug}
        required={slugRequired}
        readOnly={slugReadonly}
        placeholder={
          slugRequired
            ? "mygo-1st (빈값이면 titleEn 으로 자동 생성)"
            : undefined
        }
      />

      <fieldset className="md:col-span-2 flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-4">
        <legend className="px-1 text-sm font-medium text-[color:var(--color-foreground)]">
          섬네일
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <ThumbnailField
            id="posterUrl"
            name="posterUrl"
            label="포스터 (세로형)"
            value={values.posterUrl ?? ""}
            onChange={(v) => onChange("posterUrl", v)}
            error={errors.posterUrl?.[0]}
            aspect="3/4"
            hint="공식 키비주얼/포스터 URL."
          />
          <ThumbnailField
            id="thumbnailUrl"
            name="thumbnailUrl"
            label="섬네일 (목록용)"
            value={values.thumbnailUrl ?? ""}
            onChange={(v) => onChange("thumbnailUrl", v)}
            error={errors.thumbnailUrl?.[0]}
            aspect="square"
            hint="목록/카드에 노출할 작은 이미지."
          />
        </div>
      </fieldset>

      {includeNotes ? (
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label htmlFor="notes">노트 (markdown)</Label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            value={values.notes ?? ""}
            onChange={(e) => onChange("notes", e.target.value)}
            className="flex w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2 text-sm"
          />
          <FieldError messages={errors.notes} />
        </div>
      ) : null}
    </div>
  );
}

function FieldGroup({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  readOnly,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  error?: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={name}>
        {label}
        {required ? (
          <span className="text-[color:var(--color-destructive)]"> *</span>
        ) : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        aria-invalid={!!error}
      />
      <FieldError messages={error} />
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <p role="alert" className="text-xs text-[color:var(--color-destructive)]">
      {messages[0]}
    </p>
  );
}
