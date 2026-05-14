import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // typedRoutes 는 동적 라우트 segment 와의 호환 문제로 본 사이클에서 비활성화.
    // 정적 분석이 필요해지면 다시 활성화하면서 모든 Link/router.push 에
    // Route 타입을 명시할 것.
    typedRoutes: false,
  },
};

export default nextConfig;
