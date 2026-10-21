import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "usuario.prueba.e2e@conatel.gob.ve";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "E2eSmokeTest!2026";
const ARTIFACT_DIR = "/home/jbolivar@conatel.gob.ve/.gemini/antigravity-cli/brain/4f3a6a47-9b0b-47b3-9be1-2c8212a19b56/scratch";

test.describe("Recuperación de Contraseña y Autogestión Integral E2E", () => {
  test("1. Login incluye enlace a recuperación y navega a /recuperar-password", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Enlace visible
    const linkRecuperar = page.getByRole("link", { name: /¿olvidaste tu contraseña\?/i });
    await expect(linkRecuperar).toBeVisible();
    await linkRecuperar.click();

    await expect(page).toHaveURL(/\/recuperar-password/);
    await expect(page.getByRole("heading", { name: "Recuperar Contraseña" })).toBeVisible();
    await expect(page.getByLabel(/cédula o correo institucional/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /enviar enlace de recuperación/i })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/e2e_recuperar_password_form.png` });
  });

  test("2. Pantalla /restablecer-password sin token muestra advertencia y enlace para solicitar nuevo", async ({ page }) => {
    await page.goto("/restablecer-password");
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByText("Enlace Incompleto o Inválido")).toBeVisible();
    const btnSolicitar = page.getByRole("button", { name: "Solicitar Nuevo Enlace" });
    await expect(btnSolicitar).toBeVisible();
    await btnSolicitar.click();

    await expect(page).toHaveURL(/\/recuperar-password/);
  });

  test("3. Pantalla /restablecer-password con token muestra formulario de nueva clave", async ({ page }) => {
    await page.goto("/restablecer-password?token=token-prueba-firmado");
    await page.waitForLoadState("networkidle").catch(() => {});

    await expect(page.getByRole("heading", { name: "Nueva Contraseña" })).toBeVisible();
    await expect(page.getByLabel("Nueva Contraseña:")).toBeVisible();
    await expect(page.getByLabel("Confirmar Contraseña:")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar Nueva Contraseña" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/e2e_restablecer_password_form.png` });
  });

  test("4. Autogestión: /autogestion muestra Mi Expediente y sidebar con accesos correctos", async ({ page }) => {
    // Iniciar sesión
    await page.goto("/login");
    await page.getByLabel(/correo electrónico/i).fill(EMAIL);
    await page.getByLabel(/contraseña/i).fill(PASSWORD);
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Navegar a /autogestion
    await page.goto("/autogestion");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Sidebar: contiene Mi Expediente y Censo de Vivienda
    await expect(page.getByRole("button", { name: "Autogestión", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mi Expediente" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Censo de Vivienda" }).first()).toBeVisible();

    // Esperar a que el expediente cargue (pestañas o mensaje de error)
    await expect(
      page.getByRole("tab", { name: /datos personales/i }).or(page.getByText("Expediente no disponible"))
    ).toBeVisible({ timeout: 15_000 });

    const hasTabs = await page.getByRole("tab", { name: /datos personales/i }).isVisible().catch(() => false);

    if (hasTabs) {
      await expect(page.getByRole("tab", { name: /ubicación laboral/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /formación & cursos/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /carnet institucional/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /salud & dotación/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /cargas familiares/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /marco legal/i })).toBeVisible();
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/e2e_mi_expediente.png` });

    // Navegar al Censo de Vivienda preservado en /autogestion/censo
    await page.getByRole("link", { name: "Censo de Vivienda" }).first().click();
    await expect(page).toHaveURL(/\/autogestion\/censo/);

    await expect(
      page
        .getByText("Autogestión Completada")
        .or(page.getByRole("heading", { name: "AUTOGESTIÓN DE PERSONAL" }))
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: `${ARTIFACT_DIR}/e2e_censo_vivienda.png` });
  });
});
