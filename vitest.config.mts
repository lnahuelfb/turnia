import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resuelve el alias "@/*" de tsconfig.json de forma nativa.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
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
