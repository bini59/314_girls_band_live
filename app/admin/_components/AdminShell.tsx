import * as React from "react";

import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

/**
 * AdminShell — TopBar + Sidebar + 본문 영역.
 *
 * 인증 가드는 호출 레이아웃(`app/admin/lives/layout.tsx`)이 담당.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
