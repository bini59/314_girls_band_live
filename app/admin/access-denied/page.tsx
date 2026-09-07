export const dynamic = "force-dynamic";

export default function AdminAccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-3 p-8">
      <h1 className="text-2xl font-semibold">접근 권한이 없습니다</h1>
      <p className="text-muted-foreground">
        gbl 서비스의 활성 admin membership이 있는 계정만 backoffice에 들어올 수 있습니다.
      </p>
    </main>
  );
}
