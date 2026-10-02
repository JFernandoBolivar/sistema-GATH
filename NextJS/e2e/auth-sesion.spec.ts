import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "usuario.prueba.e2e@conatel.gob.ve";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "E2eSmokeTest!2026";

async function iniciarSesion(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo electrónico/i).fill(EMAIL);
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("Ciclo de vida de sesión, tokens y aviso de inactividad E2E", () => {
  test("1. Autenticación exitosa y verificación de cookies HttpOnly (dj_access y dj_refresh)", async ({ page, context }) => {
    await iniciarSesion(page);

    const cookies = await context.cookies();
    const accessCookie = cookies.find((c) => c.name === "dj_access");
    const refreshCookie = cookies.find((c) => c.name === "dj_refresh");

    expect(accessCookie, "cookie dj_access debe existir").toBeDefined();
    expect(accessCookie?.httpOnly, "dj_access debe ser HttpOnly").toBe(true);

    expect(refreshCookie, "cookie dj_refresh debe existir").toBeDefined();
    expect(refreshCookie?.httpOnly, "dj_refresh debe ser HttpOnly").toBe(true);
  });

  test("2. Flujo completo de inactividad: aviso a los 14 min, extensión de sesión y auto-logout tras período de gracia", async ({ page }) => {
    // Instalar reloj virtual para controlar el paso del tiempo de forma determinista
    await page.clock.install();
    await iniciarSesion(page);
    await page.waitForLoadState("domcontentloaded");

    // A. Antes de los 14 minutos no debe existir el modal de advertencia
    await expect(page.getByText(/Tu sesión está por cerrarse por inactividad/i)).toHaveCount(0);

    // B. Avanzamos 14 minutos de inactividad (IDLE_TIMEOUT - GRACE_PERIOD = 840s)
    await page.clock.fastForward(14 * 60 * 1000);

    // C. Debe mostrarse la ventana modal de aviso con sus componentes
    const modalAviso = page.getByText(/Tu sesión está por cerrarse por inactividad/i);
    await expect(modalAviso).toBeVisible({ timeout: 5_000 });

    const btnPermanecer = page.getByRole("button", { name: /Permanecer en la sesión/i });
    const btnCerrar = page.getByRole("button", { name: /Cerrar sesión/i });
    await expect(btnPermanecer).toBeVisible();
    await expect(btnCerrar).toBeVisible();
    await expect(page.getByText(/Se cerrará automáticamente en \d+ segundos/i)).toBeVisible();

    // D. Probar botón "Permanecer en la sesión": extiende tokens y reinicia timer
    await btnPermanecer.click();

    // El diálogo debe cerrarse y el usuario continúa autenticado
    await expect(modalAviso).toHaveCount(0);
    expect(page.url()).toContain("/dashboard");

    // E. Avanzamos nuevamente 14 minutos: el modal debe reaparecer
    await page.clock.fastForward(14 * 60 * 1000);
    await expect(modalAviso).toBeVisible({ timeout: 5_000 });

    // F. Dejar transcurrir los 60 segundos de gracia sin intervención
    await page.clock.fastForward(61 * 1000);

    // G. El sistema debe cerrar la sesión automáticamente y redirigir a /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("3. Cierre voluntario de sesión desde el aviso de inactividad", async ({ page }) => {
    await page.clock.install();
    await iniciarSesion(page);
    await page.waitForLoadState("domcontentloaded");

    // Avanzamos 14 minutos para gatillar el aviso
    await page.clock.fastForward(14 * 60 * 1000);
    const btnCerrar = page.getByRole("button", { name: /Cerrar sesión/i });
    await expect(btnCerrar).toBeVisible({ timeout: 5_000 });

    // El usuario pulsa voluntariamente "Cerrar sesión"
    await btnCerrar.click();

    // Debe redirigir de inmediato a /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
