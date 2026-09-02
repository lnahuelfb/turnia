import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests de integración: corren contra un Postgres real (service container en
 * CI, o una base local vía DATABASE_URL). Sin paralelismo entre archivos para
 * no pisarse la base.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./src/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
