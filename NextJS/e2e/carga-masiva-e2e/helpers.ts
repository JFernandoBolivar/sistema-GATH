import { Page, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

export const CAPTURAS_DIR = path.resolve(__dirname, "../auditoria/o47");

if (!fs.existsSync(CAPTURAS_DIR)) {
  fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
}

export async function iniciarSesion(
  page: Page,
  email = "e2e.administrador@auditoria.local",
  password = "E2eClaude2026*"
): Promise<void> {
  for (let intento = 0; intento < 2; intento++) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
      return;
    } catch (error) {
      if (intento === 1) throw error;
      await page.waitForTimeout(2_000);
    }
  }
}

export async function cerrarSesion(page: Page): Promise<void> {
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

export async function verificarSinDesborde(page: Page, etiqueta: string): Promise<boolean> {
  const data = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
    const clientW = doc.clientWidth;
    return {
      scrollWidth: scrollW,
      clientWidth: clientW,
      hasOverflow: scrollW > clientW + 1,
    };
  });

  if (data.hasOverflow) {
    console.warn(`[DESBORDE DETECTADO] en ${etiqueta}: scrollWidth=${data.scrollWidth}, clientWidth=${data.clientWidth}`);
  }
  return !data.hasOverflow;
}

export async function tomarCaptura(page: Page, nombre: string): Promise<string> {
  const ruta = path.join(CAPTURAS_DIR, nombre);
  await page.screenshot({ path: ruta, fullPage: true });
  return ruta;
}
