import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.{test,spec}.ts", "**/*.{test,spec}.tsx"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    // 인프라 보강: DB 격리를 위해 단일 fork 로 실행한다.
    // integration 테스트가 같은 Postgres 인스턴스를 공유하므로 병렬 실행 시
    // TRUNCATE 가 서로의 fixture 를 덮어쓴다.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/e2e/**",
        "**/*.config.*",
        "**/prisma/migrations/**",
        "**/test/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
