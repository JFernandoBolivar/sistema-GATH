/** Credenciales E2E solo por entorno (R15): nunca valores por defecto en el repositorio. */
function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable ${nombre} (ver e2e/README o .env.test.local).`);
  return valor;
}

export const EMAIL = requerida("E2E_ADMIN_EMAIL");
export const PASSWORD = requerida("E2E_ADMIN_PASSWORD");

import { expect, type Page } from "@playwright/test";

/**
 * Login robusto: espera a que el formulario esté hidratado (si se pulsa antes,
 * el envío nativo recarga /login) y reintenta una vez si sigue en /login.
 * Acepta cualquier destino post-login (dashboard, inicio, autogestión).
 */
export async function iniciarSesionE2E(page: Page): Promise<void> {
  for (let intento = 0; intento < 2; intento++) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.getByLabel(/correo electrónico/i).fill(EMAIL);
    await page.getByLabel(/contraseña/i).fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
      return;
    } catch {
      if (intento === 1) await expect(page).not.toHaveURL(/\/login/);
    }
  }
}
