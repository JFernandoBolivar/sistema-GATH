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

test.describe("Organización UI - Paridad 100% con referencia", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await login(page);
  });

  test("1. /organizacion muestra HeaderLayout, AppSidebarPersonal y Estructura Organizacional", async ({ page }) => {
    await page.goto("/organizacion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // HeaderLayout
    await expect(page.locator("header").getByRole("heading", { name: "Gestión Administrativa de Talento Humano - GATH" })).toBeVisible();
    await expect(page.locator("header").getByText("Gestiona y Visualiza la Información de los Trabajadores en Conatel")).toBeVisible();

    // AppSidebarPersonal
    await expect(page.locator("img[alt='Logo CONATEL']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ub. Administrativas", exact: true })).toBeVisible();

    // Main Page Title & Tabs
    await expect(page.getByRole("heading", { name: "Listado De Ubicaciones Administrativas" })).toBeVisible();
    await expect(page.getByText("Estructura Jerárquica y Dependencias de CONATEL")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Explorar" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Organismos adscritos" })).toBeVisible();

    // Selects and tables
    await expect(page.getByText("Dependencia", { exact: true })).toBeVisible();
    await expect(page.getByText("Dirección general", { exact: true })).toBeVisible();
    await expect(page.getByText("Dirección de línea", { exact: true })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/1_organizacion_explorar.png` });
  });

  test("2. /organizacion/dependencias muestra gestión de dependencias", async ({ page }) => {
    await page.goto("/organizacion/dependencias");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title
    await expect(page.getByRole("heading", { name: "Gestión de Ubicaciones Administrativas" })).toBeVisible();
    await expect(page.getByText("Registre Nuevas Ubicaciones Administrativas Para Trabajadores")).toBeVisible();

    // Table / list
    await expect(page.getByRole("heading", { name: "Dependencias" })).toBeVisible();
    await expect(page.getByText("Volver a Organización")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/2_organizacion_dependencias.png` });
  });

  test("3. /organizacion/direcciones-linea muestra creación de direcciones", async ({ page }) => {
    await page.goto("/organizacion/direcciones-linea");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title
    await expect(page.getByRole("heading", { name: "Crear Direcciones Administrativas" })).toBeVisible();
    await expect(page.getByText("Registre Nuevas Direcciones de Línea, Divisiones o Coordinaciones")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/3_organizacion_direcciones_linea.png` });
  });

  test("4. /organizacion/coordinaciones muestra gestión de coordinaciones", async ({ page }) => {
    await page.goto("/organizacion/coordinaciones");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title
    await expect(page.getByRole("heading", { name: "Actualizar Información De Dependencias" })).toBeVisible();
    await expect(page.getByText("Gestione las Coordinaciones de la Institución")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/4_organizacion_coordinaciones.png` });
  });
});
