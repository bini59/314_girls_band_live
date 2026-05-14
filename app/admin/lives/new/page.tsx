import NewLiveForm from "./NewLiveForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "새 라이브 등록 — 걸즈밴드 라이브",
};

/**
 * `/admin/lives/new` — 라이브 헤더 등록 페이지.
 *
 * 본 사이클은 헤더 필드만. 밴드/포맷/티어/라운드는 라이브 생성 후 편집기에서 추가.
 */
export default function NewLivePage() {
  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[color:var(--color-foreground)]">
          새 라이브 등록
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-muted-foreground)]">
          헤더 정보를 입력하고 저장하면 편집기로 이동합니다.
        </p>
      </header>
      <NewLiveForm />
    </div>
  );
}
