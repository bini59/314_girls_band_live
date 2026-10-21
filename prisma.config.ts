import { defineConfig } from "prisma/config";
// CLI diff requires a datasource URL; migrations use Wrangler, never this file.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: "file:./unused.db" },
});
