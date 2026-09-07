import type { Metadata } from "next";
import { GoogleTagManager } from "@next/third-parties/google";

import { ThemeScript } from "@/components/theme/theme-script";

import "./globals.css";

// GTM 컨테이너 ID (공개값). GA4 측정 ID(G-M3T40FCMQZ)는 GTM 컨테이너에서 관리.
const GTM_ID = "GTM-W8CC3949";

export const metadata: Metadata = {
  title: "원정가고싶다",
  description: "애니/게임 기반 걸즈밴드 라이브 일정 아카이브",
  icons: {
    icon: [16, 32, 64, 128, 256, 512].map((size) => ({
      url: `https://static.bini59.dev/logo/logo-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
    shortcut: "https://static.bini59.dev/logo/logo-32.png",
    apple: "https://static.bini59.dev/logo/logo-512.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      {process.env.NODE_ENV === "production" && <GoogleTagManager gtmId={GTM_ID} />}
      <body>{children}</body>
    </html>
  );
}
