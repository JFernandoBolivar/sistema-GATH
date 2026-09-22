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

test.describe("Carnetización UI - Paridad 100% con referencia", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await login(page);
  });

  test("1. /carnetizacion muestra HeaderLayout, AppSidebarCarnetizacion y bienvenida idéntica", async ({ page }) => {
    await page.goto("/carnetizacion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // HeaderLayout
    await expect(page.locator("header").getByRole("heading", { name: "Sistema de Carnetización" })).toBeVisible();
    await expect(page.getByText("Generación y Gestión de Carnets del Personal - CONATEL")).toBeVisible();

    // AppSidebarCarnetizacion
    await expect(page.locator("img[alt='Logo CONATEL']")).toBeVisible();
    await expect(page.getByText("Inicio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Carnets" })).toBeVisible();
    await expect(page.getByText("Buscar Personal")).toBeVisible();
    await expect(page.getByText("Estadísticas")).toBeVisible();
    await expect(page.getByText("Plantillas")).toBeVisible();
    await expect(page.getByText("Autogestión")).toBeVisible();

    // Welcome title & content
    await expect(page.locator("h1.text-8xl")).toBeVisible();
    await expect(page.getByText("Generación y gestión de carnets del personal de CONATEL")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/1_carnetizacion_welcome.png` });
  });

  test("2. /carnetizacion/buscar muestra formulario y búsqueda de personal", async ({ page }) => {
    await page.goto("/carnetizacion/buscar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Buscar Personal" })).toBeVisible();
    await expect(page.getByText("Busca un trabajador por cédula o nombre para generar su carnet")).toBeVisible();
    await expect(page.getByPlaceholder("Ingrese cédula o nombre del trabajador...")).toBeVisible();

    // Buscar por cédula
    await page.getByPlaceholder("Ingrese cédula o nombre del trabajador...").fill("30540767");
    await page.getByRole("button", { name: /buscar/i }).click();

    // Esperar resultado
    await expect(page.getByText("HITLER MOISES MACHADO CORRO")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("C.I: 30540767")).toBeVisible();
    await expect(page.getByText("ASISTENTE ADMINISTRATIVO")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generar Carnet" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/2_carnetizacion_buscar.png` });
  });

  test("3. /carnetizacion/generar muestra datos del trabajador y vista previa del carnet", async ({ page }) => {
    await page.goto("/carnetizacion/generar?cedula=30540767");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Generar Carnet" })).toBeVisible();
    await expect(page.getByText("Datos del Personal")).toBeVisible();
    await expect(page.getByText("Vista Previa del Carnet")).toBeVisible();

    // Verificar inputs con datos cargados
    const inputCedula = page.locator("#input-cedula");
    await expect(inputCedula).toBeVisible();
    await expect(inputCedula).toHaveValue("30540767");
    await expect(inputCedula).toBeDisabled();

    await expect(page.getByLabel("Nombre completo")).toBeVisible();

    const inputCodigo = page.locator("#input-codigo");
    await expect(inputCodigo).toBeVisible();
    await expect(inputCodigo).toHaveValue("10010105");
    await expect(inputCodigo).toBeDisabled();

    const inputCargo = page.locator("#input-cargo");
    await expect(inputCargo).toBeVisible();
    await expect(inputCargo).toHaveValue("ASISTENTE ADMINISTRATIVO");
    await expect(inputCargo).toBeDisabled();

    // Botones de acción
    await expect(page.getByRole("button", { name: /subir foto/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /generar carnet/i })).toBeVisible();

    // Vista previa
    await expect(page.locator("img[alt='Vista previa del carnet']")).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: `${ARTIFACT_DIR}/3_carnetizacion_generar.png` });
  });

  test("4. /carnetizacion/plantillas muestra formulario de subida y lista de plantillas", async ({ page }) => {
    await page.goto("/carnetizacion/plantillas");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Plantillas de Carnet" })).toBeVisible();
    await expect(page.getByText("Administra las plantillas de fondo para los carnets")).toBeVisible();
    await expect(page.getByText("Subir Nueva Plantilla")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByRole("button", { name: /seleccionar imagen/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /subir plantilla/i })).toBeVisible();

    // Verificar plantilla existente
    await expect(page.getByText("PLANTILLA OFICIAL")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Activa")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/4_carnetizacion_plantillas.png` });
  });

  test("5. /carnetizacion/estadisticas muestra tarjetas de métricas y tabla de últimos carnets", async ({ page }) => {
    await page.goto("/carnetizacion/estadisticas");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Estadísticas de Carnetización" })).toBeVisible();
    await expect(page.getByText("Resumen de carnets generados y uso del sistema")).toBeVisible();

    // Tarjetas métricas
    await expect(page.getByText("Total Carnets")).toBeVisible();
    await expect(page.getByText("Carnets Activos")).toBeVisible();
    await expect(page.getByText("Generados Hoy")).toBeVisible();
    await expect(page.getByText("Este Mes")).toBeVisible();

    // Tabla
    await expect(page.getByText("Últimos Carnets Generados")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/5_carnetizacion_estadisticas.png` });
  });
});
