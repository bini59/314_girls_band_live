import LoginForm from "./LoginForm";
import { redirect } from "next/navigation";

import { buildAuthLoginUrl, isRemoteAuthConfigured } from "@/lib/auth/remote";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "어드민 로그인 — 원정가고싶다",
};

export default function AdminLoginPage() {
  if (isRemoteAuthConfigured()) {
    const appOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
    redirect(buildAuthLoginUrl(new URL("/admin/lives", appOrigin).toString()));
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-sm flex-col justify-center p-8">
      <h1 className="mb-6 text-2xl font-semibold text-[color:var(--color-foreground)]">
        어드민 로그인
      </h1>
      <LoginForm />
    </main>
  );
}
