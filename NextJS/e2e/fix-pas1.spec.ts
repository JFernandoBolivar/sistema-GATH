import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { iniciarSesionComo } from "./inicio-sesion";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e.administrador@auditoria.local";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "E2eClaude2026*";
const OUT_DIR = path.resolve(__dirname, "auditoria/fix-pas1");

test.beforeAll(() => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
});

test.describe("FIX-PAS1: Jubilación y vigencia de pasivos", () => {
  test("PC (1366x768) — Listado, detalle y registro de pasivos", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await iniciarSesionComo(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // 1. Listado
    await page.goto("/pasivos/consultar");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByRole("heading", { name: "Consultar Pasivo" })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT_DIR, "pc-01-pasivos-listado.png"), fullPage: false });

    // 2. Detalle
    const primerBotonMenu = page.getByRole("row").nth(1).getByRole("button", { name: /abrir menú/i });
    if (await primerBotonMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await primerBotonMenu.click();
      const itemVerDetalle = page.getByRole("menuitem", { name: /ver detalle/i });
      if (await itemVerDetalle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await itemVerDetalle.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUT_DIR, "pc-02-pasivo-detalle.png") });
        // Cerrar sheet
        const closeBtn = page.getByRole("button", { name: /close|cerrar/i });
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
      }
    }

    // 3. Registro
    await page.goto("/pasivos/registrar");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByRole("heading", { name: /Datos de pensión/i })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT_DIR, "pc-03-registrar-pasivo.png"), fullPage: false });
  });

  test("Teléfono (360x740) — Listado, detalle y registro de pasivos", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await iniciarSesionComo(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // 1. Listado
    await page.goto("/pasivos/consultar");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByRole("heading", { name: "Consultar Pasivo" })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT_DIR, "tel-01-pasivos-listado.png"), fullPage: false });

    // 2. Detalle
    const primerBotonMenu = page.getByRole("row").nth(1).getByRole("button", { name: /abrir menú/i });
    if (await primerBotonMenu.isVisible({ timeout: 5000 }).catch(() => false)) {
      await primerBotonMenu.click();
      const itemVerDetalle = page.getByRole("menuitem", { name: /ver detalle/i });
      if (await itemVerDetalle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await itemVerDetalle.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUT_DIR, "tel-02-pasivo-detalle.png") });
        // Cerrar sheet
        const closeBtn = page.getByRole("button", { name: /close|cerrar/i });
        if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
      }
    }

    // 3. Registro
    await page.goto("/pasivos/registrar");
    await page.waitForLoadState("networkidle").catch(() => {});
    await expect(page.getByRole("heading", { name: /Datos de pensión/i })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(OUT_DIR, "tel-03-registrar-pasivo.png"), fullPage: false });
  });
});
