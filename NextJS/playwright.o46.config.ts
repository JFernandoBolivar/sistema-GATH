import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

/** Carga las credenciales E2E del archivo local sin depender de dotenv. */
function cargarEnvLocal(): void {
  const archivo = path.resolve(__dirname, ".env.test.local");
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const separador = limpia.indexOf("=");
    if (separador <= 0) continue;
    const clave = limpia.slice(0, separador).trim();
    const valor = limpia.slice(separador + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[clave]) process.env[clave] = valor;
  }
}

cargarEnvLocal();

export default defineConfig({
  testDir: "./e2e/flujos",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e-results/o46-resultados.json" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "pc",
      use: { viewport: { width: 1366, height: 768 } },
    },
    {
      // Emulación móvil sobre Chromium (WebKit no está instalado en este entorno).
      name: "telefono",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
