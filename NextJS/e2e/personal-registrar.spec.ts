import { test, expect, type Page } from "@playwright/test";

/**
 * Wizard de registro de trabajador (`/personal/registrar`): recorre los 7
 * pasos con paridad de textos respecto al legado. NO envía el último paso,
 * para no crear registros en la BD real.
 */
const EMAIL = process.env.E2E_ADMIN_EMAIL || "usuario.prueba.e2e@conatel.gob.ve";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "E2eSmokeTest!2026";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo electrónico/i).fill(EMAIL);
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/** Combobox dentro del FormItem cuyo label contiene `label` (el Combobox no recibe el id del label). */
function comboPorLabel(page: Page, label: string | RegExp) {
  return page.locator('[data-slot="form-item"]').filter({ has: page.getByText(label) }).getByRole("combobox");
}

async function elegirOpcion(page: Page, trigger: ReturnType<Page["locator"]>) {
  await trigger.click();
  await page.getByRole("option").first().click();
}

test.describe("Personal - wizard de registro", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/personal/registrar");
    await expect(page.getByText("Paso 1: Información Basica")).toBeVisible({ timeout: 15_000 });
  });

  test("valida el paso 1 con los mensajes del legado", async ({ page }) => {
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByText("Solo Se Permiten Números")).toBeVisible();
    await expect(page.getByText("Debe Seleccionar Un Sexo")).toBeVisible();
    await expect(page.getByText("Debe Seleccionar Una Nacionalidad")).toBeVisible();
  });

  test("opción \"Otra\" en carrera e institución revela el input y exige el nombre", async ({ page }) => {
    await page.getByLabel("Cedula de Identidad *").fill("99999992");
    await page.getByLabel("Nombre *").fill("Prueba");
    await page.getByLabel("Apellidos *").fill("Otra");
    await page.getByLabel("Fecha de Nacimiento *").click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator("select").nth(1).selectOption("1990");
    await popover.locator("button[data-day]").first().click();
    await page.keyboard.press("Escape");
    // Nacionalidad (V/E), Sexo y Estado Civil
    for (const i of [0, 1, 2]) await elegirOpcion(page, page.getByRole("combobox").nth(i));
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByText("Paso 2: Información Academica")).toBeVisible();

    // Un nivel con carreras (no "No posee") para que aparezca "Otra".
    await page.getByLabel("1. Nivel Academico").click();
    await page.getByRole("option", { name: "Doctorado" }).click();

    await expect(page.getByPlaceholder("Nueva carrera...")).toBeHidden();
    await expect(comboPorLabel(page, "Carrera (Opcional)")).toBeEnabled();
    await comboPorLabel(page, "Carrera (Opcional)").click();
    await page.getByRole("option", { name: "Otra", exact: true }).last().click();
    await expect(page.getByPlaceholder("Nueva carrera...")).toBeVisible();
    await expect(page.getByText("Se asociará al nivel académico seleccionado.")).toBeVisible();

    await comboPorLabel(page, /^Institución/).click();
    await page.getByRole("option", { name: "Otra", exact: true }).last().click();
    await expect(page.getByPlaceholder("Nueva institución...")).toBeVisible();

    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await expect(page.getByText("Debe escribir el nombre de la nueva carrera")).toBeVisible();
    await expect(page.getByText("Debe escribir el nombre de la nueva institución")).toBeVisible();

    await page.getByPlaceholder("Nueva carrera...").fill("Carrera De Prueba E2E");
    await page.getByPlaceholder("Nueva institución...").fill("Institucion De Prueba E2E");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    // Avanza: el alta real solo ocurre al finalizar el wizard (este test no lo finaliza).
    await expect(page.getByText("Opcional si no posee formación complementaria")).toBeVisible();
  });

  test("recorre los 7 pasos en el orden del legado", async ({ page }) => {
    test.setTimeout(90_000);
    const siguiente = () => page.getByRole("button", { name: "Siguiente", exact: true }).click();

    // Paso 1
    await page.getByLabel("Cedula de Identidad *").fill("99999991");
    await page.getByLabel("Nombre *").fill("Prueba");
    await page.getByLabel("Apellidos *").fill("Wizard");
    await page.getByLabel("Fecha de Nacimiento *").click();
    const popover = page.locator("[data-radix-popper-content-wrapper]");
    await popover.locator("select").nth(1).selectOption("1990");
    await popover.locator("button[data-day]").first().click();
    await page.keyboard.press("Escape");
    // Nacionalidad (V/E), Sexo y Estado Civil
    for (const i of [0, 1, 2]) await elegirOpcion(page, page.getByRole("combobox").nth(i));
    await siguiente();

    // Paso 2
    await expect(page.getByText("Paso 2: Información Academica")).toBeVisible();
    await expect(page.getByText("Opcional si no posee formación académica")).toBeVisible();
    await elegirOpcion(page, page.getByLabel("1. Nivel Academico"));
    // Cascada Nivel -> Carrera: el combobox de carrera se habilita con las del nivel
    await expect(comboPorLabel(page, "Carrera (Opcional)")).toBeEnabled();
    await comboPorLabel(page, "Carrera (Opcional)").click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await siguiente();

    // Paso 3
    await expect(page.getByText("Formación Complementaria", { exact: true })).toBeVisible();
    await expect(page.getByText("Opcional si no posee formación complementaria")).toBeVisible();
    await siguiente();

    // Paso 4
    await expect(page.getByText("Antecedentes En La Administracion Publica", { exact: true })).toBeVisible();
    await siguiente();

    // Paso 5
    await expect(page.getByText("Paso 4: Perfil De Salud")).toBeVisible();
    await expect(page.getByText("Patologias (Opcional)")).toBeVisible();
    await siguiente();

    // Paso 6
    await expect(page.getByText("Paso 5: Datos De Vestimenta")).toBeVisible();
    await siguiente();
    await expect(page.getByText("Debe seleccionar una talla de camisa")).toBeVisible();
    for (const i of [0, 1, 2]) await elegirOpcion(page, page.getByRole("combobox").nth(i));
    await siguiente();

    // Paso 7 (no se envía)
    await expect(page.getByText("Paso 6: Datos De Vivienda")).toBeVisible();
    await expect(page.getByText("Direccion Exacta *")).toBeVisible();
    await expect(page.getByText("Código Postal *")).toBeVisible();

    // Cascada Estado -> Municipio / Código Postal -> Parroquia
    await page.getByRole("combobox").filter({ hasText: "Seleccione un Estado" }).click();
    await page.getByRole("option").first().click();
    await page.getByRole("combobox").filter({ hasText: "Seleccione un Municpio" }).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.getByRole("option").first().click();
    await page.getByRole("combobox").filter({ hasText: "Seleccione una Parroquia" }).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("combobox").filter({ hasText: "Seleccione un Código Postal" }).click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toBeVisible();
  });
});
