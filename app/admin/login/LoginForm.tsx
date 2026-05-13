"use client";

import { useActionState } from "react";
import { signInAction, type SignInState } from "./actions";

const initialState: SignInState = undefined;

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState<SignInState, FormData>(
    signInAction,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-[color:var(--color-muted-foreground)]">
          비밀번호
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-3 py-2 text-[color:var(--color-foreground)] outline-none focus:ring-2 focus:ring-[color:var(--color-ring)]"
        />
      </label>

      {state?.ok === false ? (
        <p
          role="alert"
          className="text-sm text-[color:var(--color-destructive)]"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-[var(--radius-md)] bg-[color:var(--color-primary)] px-4 py-2 text-[color:var(--color-primary-foreground)] disabled:opacity-60"
      >
        {isPending ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
