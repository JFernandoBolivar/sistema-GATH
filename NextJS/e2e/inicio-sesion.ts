import { expect, type Page } from "@playwright/test";

/**
 * Login robusto con credenciales explícitas: espera a que el formulario esté hidratado
 * (si se pulsa antes, el envío nativo recarga /login) y reintenta una vez si sigue en /login.
 * Acepta cualquier destino post-login (dashboard, inicio, autogestión).
 */
export async function iniciarSesionComo(page: Page, email: string, password: string): Promise<void> {
  for (let intento = 0; intento < 2; intento++) {
    await page.goto("/login");
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.getByLabel(/correo electrónico/i).fill(email);
    await page.getByLabel(/contraseña/i).fill(password);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45_000 });
      return;
    } catch {
      if (intento === 1) await expect(page).not.toHaveURL(/\/login/);
    }
  }
}
