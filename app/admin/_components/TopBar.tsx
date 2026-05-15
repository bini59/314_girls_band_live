import { ThemeToggle } from "@/components/theme/theme-toggle";

import { SignOutButton } from "./SignOutButton";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[color:var(--color-page)]/85 px-4 backdrop-blur">
      <div className="text-sm font-bold tracking-[var(--tracking-button)] text-[color:var(--color-foreground)]">
        원정가고싶다 · 관리자
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  );
}
