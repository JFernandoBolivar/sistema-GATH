import { test, expect, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";
const ARTIFACT_DIR = "/home/jbolivar@conatel.gob.ve/.gemini/antigravity-cli/brain/4f3a6a47-9b0b-47b3-9be1-2c8212a19b56/scratch";

async function login(page: Page) {
  await iniciarSesionE2E(page);
}

test.describe("Autogestión UI - Paridad 100% con referencia", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await login(page);
  });

  test("1. /autogestion muestra HeaderLayout, AppSidebarAutogestion y Formulario o Tarjeta de Finalización", async ({ page }) => {
    await page.goto("/autogestion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // HeaderLayout
    await expect(page.locator("header").getByRole("heading", { name: "Gestión Administrativa de Talento Humano - GATH" })).toBeVisible();
    await expect(page.locator("header").getByText("Autogestión de Personal")).toBeVisible();

    // AppSidebarAutogestion
    await expect(page.locator("img[alt='Logo CONATEL']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Autogestión", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mi Expediente" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Censo de Vivienda" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Respuestas Encuesta" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Métricas" })).toBeVisible();

    // Body content de /autogestion (Mi Expediente)
    await expect(
      page.getByRole("tab", { name: /datos personales/i }).or(page.getByText("Expediente no disponible")),
    ).toBeVisible({ timeout: 30_000 });

    // Navegar a Censo de Vivienda (/autogestion/censo)
    await page.goto("/autogestion/censo");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(
      page
        .getByText("Autogestión Completada")
        .or(page.getByRole("heading", { name: "AUTOGESTIÓN DE PERSONAL" }))
    ).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: `${ARTIFACT_DIR}/1_autogestion_formulario.png` });
  });

  test("2. /autogestion/consultar muestra tabla de censados, búsqueda, filtros y sheet de detalle", async ({ page }) => {
    await page.goto("/autogestion/consultar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Header & Title
    await expect(page.getByRole("heading", { name: "Respuestas del Censo" })).toBeVisible();
    await expect(page.getByText("Consulta las respuestas del censo de vivienda por trabajador")).toBeVisible();
    await expect(page.getByPlaceholder("buscar cedula...")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar Excel General" })).toBeVisible();

    // Filters form
    await expect(page.getByText("Filtros para Exportar Excel")).toBeVisible();

    // Table rows
    const table = page.locator("table");
    await expect(table).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("columnheader", { name: "Cedula" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Nombres" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Apellidos" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Carnet Patria" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "APN" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Acciones" })).toBeVisible();

    // Click "Ver" on the first row to open SheetUI if available
    const verButton = page.getByRole("button", { name: "Ver" }).first();
    if (await verButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await verButton.click();
      await expect(page.getByRole("heading", { name: /detalle del censo/i })).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText("Datos del Trabajador")).toBeVisible();
    }

    await page.screenshot({ path: `${ARTIFACT_DIR}/2_autogestion_consultar.png` });
  });

  test("3. /autogestion/metricas muestra DonutChart, BarChart y formulario de filtros", async ({ page }) => {
    await page.goto("/autogestion/metricas");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title & description
    await expect(page.getByRole("heading", { name: "Métricas del Censo" })).toBeVisible();
    await expect(page.getByText("Visualización de progreso del censo de vivienda")).toBeVisible();

    // Filter card
    await expect(page.getByText("Filtros para Reporte de Métricas")).toBeVisible();

    // Esperar a que carguen las métricas y los gráficos
    await expect(page.getByText("Progreso del Censo", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Respuestas por Dependencia", { exact: true })).toBeVisible({ timeout: 15_000 });

    // SVG elements rendered by D3 charts (Donut + Bar)
    const svgElements = page.locator("svg");
    expect(await svgElements.count()).toBeGreaterThanOrEqual(2);

    await page.screenshot({ path: `${ARTIFACT_DIR}/3_autogestion_metricas.png` });
  });
});
