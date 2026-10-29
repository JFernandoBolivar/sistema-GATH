import { test, expect, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";
const ARTIFACT_DIR = "/home/jbolivar@conatel.gob.ve/.gemini/antigravity-cli/brain/63266b19-0e09-4246-a71d-be18a1b72637/scratch";

async function login(page: Page) {
  await iniciarSesionE2E(page);
}

test.describe("Organización UI - Paridad 100% con referencia", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await login(page);
  });

  test("1. /organizacion y /organizacion/listado-ubicacion-administrativa muestran interfaz de consultar dependencias", async ({ page }) => {
    await page.goto("/organizacion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // HeaderLayout
    await expect(page.locator("header").getByRole("heading", { name: "Gestión Administrativa de Talento Humano - GATH" })).toBeVisible();
    await expect(page.locator("header").getByText("Gestiona y Visualiza la Información de los Trabajadores en Conatel")).toBeVisible();

    // AppSidebarPersonal
    await expect(page.locator("img[alt='Logo CONATEL']")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ub. Administrativas", exact: true })).toBeVisible();

    // Main Page Title
    await expect(page.getByRole("heading", { name: "Listado De Ubicaciones Administrativas" })).toBeVisible();

    // Labels y textos de ayuda legados
    await expect(page.getByText("Nivel", { exact: true })).toBeVisible();
    await expect(page.getByText("Consultar Dirección / Gerencia / Oficina")).toBeVisible();
    await expect(page.getByText("Dirección / Gerencia / Oficina", { exact: true })).toBeVisible();
    await expect(page.getByText("Consultar Divisiones")).toBeVisible();
    await expect(page.getByText("División / Coordinación", { exact: true })).toBeVisible();
    await expect(page.getByText("Consultar Coordinaciones De La División")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/1_organizacion_consultar.png` });
  });

  test("2. /organizacion/crear-ubicacion muestra formulario de creación con switches en cascada", async ({ page }) => {
    await page.goto("/organizacion/crear-ubicacion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title & description
    await expect(page.getByRole("heading", { name: "Gestión de Ubicaciones Administrativas" })).toBeVisible();
    await expect(page.getByText("Registre Nuevas Ubicaciones Administrativas Para Trabajadores")).toBeVisible();

    // Campos iniciales
    await expect(page.getByText("Código De La Dependencia")).toBeVisible();
    await expect(page.getByText("Nombre De La Dependencia")).toBeVisible();
    await expect(page.getByText("¿Desea Asignarle una Dirección General a la Dependencia?")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear Dependencia" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/2_organizacion_crear_ubicacion.png` });
  });

  test("3. /organizacion/crear-ubicacion-administrativa-direccion muestra selector radio y formulario", async ({ page }) => {
    await page.goto("/organizacion/crear-ubicacion-administrativa-direccion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title
    await expect(page.getByRole("heading", { name: "Crear Direcciones Administrativas" })).toBeVisible();

    // Radios
    await expect(page.getByText("Crear Dirección / Gerencia / Oficina")).toBeVisible();
    await expect(page.getByText("Crear División / Coordinación")).toBeVisible();
    await expect(page.getByText("Crear Coordinación")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear Dirección" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/3_organizacion_crear_direcciones.png` });
  });

  test("4. /organizacion/actualizar-ubicacion muestra pestañas de actualización", async ({ page }) => {
    await page.goto("/organizacion/actualizar-ubicacion");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // Title
    await expect(page.getByRole("heading", { name: "Actualizar Informacion De Dependencias" })).toBeVisible();

    // Pestañas
    await expect(page.getByRole("tab", { name: "Dirección / Gerencia / Oficina" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "División / Coordinación" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Coordinación", exact: true })).toBeVisible();
    await expect(page.getByText("Actualizar Dirección / Gerencia / Oficina")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/4_organizacion_actualizar.png` });
  });
});
