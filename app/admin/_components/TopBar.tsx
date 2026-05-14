import { SignOutButton } from "./SignOutButton";

export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4">
      <div className="text-sm font-medium text-[color:var(--color-foreground)]">
        관리자
      </div>
      <SignOutButton />
    </header>
  );
}
