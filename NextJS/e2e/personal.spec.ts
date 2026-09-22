import { test, expect, type Page } from "@playwright/test";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "usuario.prueba.e2e@conatel.gob.ve";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "E2eSmokeTest!2026";
const ARTIFACT_DIR = "/home/jbolivar@conatel.gob.ve/.gemini/antigravity-cli/brain/63266b19-0e09-4246-a71d-be18a1b72637/scratch";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/correo electrónico/i).fill(EMAIL);
  await page.getByLabel(/contraseña/i).fill(PASSWORD);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

test.describe("Personal UI - Paridad 100% con referencia", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await login(page);
  });

  test("1. /personal muestra HeaderLayout, AppSidebarPersonal y Welcome Page", async ({ page }) => {
    await page.goto("/personal");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // HeaderLayout
    await expect(page.locator("header").getByRole("heading", { name: "Gestión Administrativa de Talento Humano - GATH" })).toBeVisible();
    await expect(page.locator("header").getByText("Gestiona y Visualiza la Información de los Trabajadores en Conatel")).toBeVisible();

    // AppSidebarPersonal
    await expect(page.locator("img[alt='Logo CONATEL']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Personal Trabajador", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Consultar/Actualizar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agregar Trabajador" })).toBeVisible();

    // Welcome body
    await expect(page.getByText("Bienvenid@ a GATH")).toBeVisible();
    await expect(page.getByText("Consultar Trabajadores")).toBeVisible();
    await expect(page.getByText("Registrar Trabajador")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/1_personal_welcome.png` });
  });

  test("2. /personal/consultar muestra filtros (Cédula, Código, Nómina), tabla y Sheet de Detalle", async ({ page }) => {
    await page.goto("/personal/consultar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Header & Title
    await expect(page.getByRole("heading", { name: "Consultar Trabajador" })).toBeVisible();
    await expect(page.getByText("Información Detallada Del Trabajador")).toBeVisible();

    // Search filters
    await expect(page.getByPlaceholder("buscar cedula...")).toBeVisible();
    await expect(page.getByPlaceholder("buscar codigo de trabajador...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Buscar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpiar", exact: true })).toBeVisible();

    // Search for Hitler (CI 30540767)
    await page.getByPlaceholder("buscar cedula...").fill("30540767");
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await page.waitForTimeout(1500);

    // Expect Hitler in table
    await expect(page.getByText("30540767")).toBeVisible();
    await expect(page.getByText("HITLER")).toBeVisible();

    // Actions dropdown
    const actionsBtn = page.getByRole("button", { name: /abrir menú/i }).first();
    await expect(actionsBtn).toBeVisible();
    await actionsBtn.click();

    await expect(page.getByText("Copiar cédula")).toBeVisible();
    await expect(page.getByText("Ver detalle")).toBeVisible();
    await expect(page.getByText("Expediente PDF")).toBeVisible();

    // Open detail sheet
    await page.getByText("Ver detalle").click();
    await page.waitForTimeout(1500);

    await expect(page.getByRole("heading", { name: "Expediente del trabajador" })).toBeVisible();
    await expect(page.getByText("Cédula: 30540767")).toBeVisible();
    await expect(page.getByText("Datos personales")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/2_personal_consultar.png` });
  });

  test("3. /personal/registrar muestra formulario de captación de expediente", async ({ page }) => {
    await page.goto("/personal/registrar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Header & Title
    await expect(page.getByRole("heading", { name: "Captación de información del trabajador" })).toBeVisible();
    await expect(page.getByText("Recopilación en pasos estrategicos")).toBeVisible();

    // Form card
    await expect(page.getByText("Expediente del nuevo trabajador")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/3_personal_registrar.png` });
  });
});
