import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "어드민 로그인 — 걸즈밴드 라이브",
};

export default function AdminLoginPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[color:var(--color-foreground)]">
        어드민 로그인
      </h1>
      <LoginForm />
    </main>
  );
}
