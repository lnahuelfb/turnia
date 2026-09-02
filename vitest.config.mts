import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resuelve el alias "@/*" de tsconfig.json de forma nativa.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Los `*.integration.test.ts` corren aparte (necesitan Postgres real).
    include: ["src/**/*.{test,spec}.ts"],
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/**/*.{test,spec}.ts",
        "src/lib/supabase/**",
        "src/lib/prisma.ts",
      ],
    },
  },
});
