import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "걸즈밴드 라이브",
  description: "애니/게임 기반 걸즈밴드 라이브 일정 아카이브",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
