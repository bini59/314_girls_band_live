export const dynamic = "force-dynamic";

export default function AdminAuthUnavailablePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold">인증 서비스를 사용할 수 없습니다</h1>
      <p className="text-muted-foreground">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 운영자에게 알려 주세요.
      </p>
    </main>
  );
}
