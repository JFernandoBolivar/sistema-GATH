import { defineConfig, devices } from "@playwright/test";

/**
 * Configuración mínima para el smoke test E2E de verificación final
 * (task_b957536104d2). No define `webServer`: backend y frontend se
 * levantan por fuera, apuntando a la BD real NUEVABD-GATH.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e-results/results.json" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
