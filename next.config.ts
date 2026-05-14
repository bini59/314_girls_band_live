import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker production 이미지용 — `.next/standalone/` 으로 server.js + 필요한
  // node_modules 만 추출해서 이미지 슬림화. pnpm 가상 스토어 symlink 도 해소.
  output: "standalone",
  // Server Action 안에서만 사용되는 일부 모듈이 trace 누락되는 케이스 보강.
  // bcryptjs 는 Server Action(`app/admin/login/actions.ts`) 에서만 import 되어
  // standalone trace 가 인식하지 못한다.
  outputFileTracingIncludes: {
    "*": ["./node_modules/bcryptjs/**"],
  },
  experimental: {
    // typedRoutes 는 동적 라우트 segment 와의 호환 문제로 본 사이클에서 비활성화.
    // 정적 분석이 필요해지면 다시 활성화하면서 모든 Link/router.push 에
    // Route 타입을 명시할 것.
    typedRoutes: false,
  },
};

export default nextConfig;
