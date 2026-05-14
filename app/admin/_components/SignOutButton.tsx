import { signOutAction } from "../actions";
import { Button } from "@/components/ui/button";

/**
 * 로그아웃 버튼.
 *
 * `<form action={signOutAction}>` 으로 Server Action 트리거.
 * 별도 클라이언트 상태 없음.
 */
export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost" size="sm">
        로그아웃
      </Button>
    </form>
  );
}
