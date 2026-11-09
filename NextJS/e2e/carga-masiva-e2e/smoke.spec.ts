import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const CAPTURAS_DIR = path.resolve(__dirname, "../auditoria/o47");

test.beforeAll(async () => {
  if (!fs.existsSync(CAPTURAS_DIR)) {
    fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
  }
});

test("Smoke: Login y acceso a Carga Masiva", async ({ page }, testInfo) => {
  const isMobile = testInfo.project.name === "telefono";
  const prefix = isMobile ? "tel" : "pc";

  // Login
  await page.goto("/login");
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByLabel(/correo electrónico/i).fill("e2e.administrador@auditoria.local");
  await page.getByLabel(/contraseña/i).fill("E2eClaude2026*");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });

  // Ir a Carga Masiva Personal
  await page.goto("/personal/carga-masiva");
  await page.waitForLoadState("networkidle").catch(() => {});

  // Tomar captura
  const screenshotPath = path.join(CAPTURAS_DIR, `smoke-${prefix}-paso1.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Verificar título
  await expect(page.getByRole("heading", { name: /carga masiva de personal/i })).toBeVisible();

  // Verificar desborde horizontal si es móvil
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      hasOverflow: doc.scrollWidth > doc.clientWidth + 1,
    };
  });
  console.log(`[${prefix}] Overflow check:`, overflow);
  expect(overflow.hasOverflow).toBeFalsy();
});
