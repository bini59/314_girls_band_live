import path from "node:path";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config, { isServer, dev, webpack }) {
    if (dev) {
      // next dev runs in Node, using the same schema/D1 adapter with Node's
      // generated compiler loader instead of the Worker-only Wasm module import.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /generated[\\/]prisma[\\/]client(?:\.ts)?$/,
          path.resolve("generated/prisma-node/client.ts"),
        ),
      );
    } else if (isServer) {
      // Keep Prisma's Worker Wasm import for OpenNext/Wrangler. Webpack's Wasm
      // loader reads /bundle/static/wasm through fs, which cannot work in Workers.
      config.externals.push(
        (
          { context, request }: { context?: string; request?: string },
          callback: (
            error?: Error | null,
            result?: string,
            type?: string,
          ) => void,
        ) => {
          if (context && request?.endsWith(".wasm?module")) {
            callback(null, path.resolve(context, request), "import");
          } else {
            callback();
          }
        },
      );
    }
    return config;
  },
  // OpenNext consumes the standalone Next build.
  output: "standalone",
  // @bini59/design 은 dist 없이 TS 소스를 그대로 배포한다.
  transpilePackages: ["@bini59/design"],
  // Server Action 안에서만 사용되는 일부 모듈이 trace 누락되는 케이스 보강.
  // bcryptjs 는 Server Action(`app/admin/login/actions.ts`) 에서만 import 되어
  // standalone trace 가 인식하지 못한다.
  outputFileTracingIncludes: {
    "*": ["./node_modules/bcryptjs/**"],
  },
  typedRoutes: false,
  experimental: {
    // typedRoutes 는 동적 라우트 segment 와의 호환 문제로 본 사이클에서 비활성화.
    // 정적 분석이 필요해지면 다시 활성화하면서 모든 Link/router.push 에
    // Route 타입을 명시할 것.
  },
};

export default nextConfig;
