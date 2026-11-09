import { defineConfig } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: ".",
  globalSetup: "./global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    trace: "off",
    screenshot: "off", // Manually managed in test steps to target NextJS/e2e/auditoria/o47/
    video: "off",
  },
  projects: [
    {
      name: "pc",
      use: {
        viewport: { width: 1366, height: 768 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: "telefono",
      use: {
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
