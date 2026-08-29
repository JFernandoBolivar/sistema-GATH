import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "modules/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      // Debe reflejar tsconfig.json: "@/*" -> "./src/*", "#/*" -> "./*" (raíz del proyecto,
      // p.ej. "#/auth" resuelve a auth.ts). Antes apuntaba a "./src/modules", que no existe
      // todavía y rompía la resolución de cualquier test que importara "#/auth".
      "@": path.resolve(__dirname, "./src"),
      "#": path.resolve(__dirname, "."),
    },
  },
});
