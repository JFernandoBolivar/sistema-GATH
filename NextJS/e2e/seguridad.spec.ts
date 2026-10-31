import { test, expect, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";
const ARTIFACT_DIR = "/home/jbolivar@conatel.gob.ve/.gemini/antigravity-cli/brain/63266b19-0e09-4246-a71d-be18a1b72637/scratch";

async function login(page: Page) {
  await iniciarSesionE2E(page);
}

test.describe("Seguridad UI - Paridad 100% con referencia", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
    await login(page);
  });

  test("1. /usuarios muestra HeaderLayout, AppSidebarSecurity y bienvenida idéntica", async ({ page }) => {
    await page.goto("/usuarios");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    // HeaderLayout
    await expect(page.getByRole("heading", { name: "Administración del sistema" })).toBeVisible();

    // AppSidebarSecurity
    await expect(page.locator("img[alt='Logo 1']")).toBeVisible();
    await expect(page.getByText("Usuarios y roles").first()).toBeVisible();
    await expect(page.getByText("Configuración").first()).toBeVisible();

    // Welcome title
    await expect(page.getByText("Bienvenid@ a")).toBeVisible();
    await expect(page.getByText("GATH")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/1_seguridad_welcome.png` });
  });

  test("2. /usuarios/modificar muestra formulario de búsqueda y tabla de usuarios", async ({ page }) => {
    await page.goto("/usuarios/modificar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Usuarios", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /buscar/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /limpiar/i })).toBeVisible();

    await expect(page.getByRole("columnheader", { name: /cédula/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /nombres/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /apellidos/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /rol/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /departamento/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /activo\/bloqueado/i })).toBeVisible();

    // Buscar cédula 30540767
    await page.getByLabel("Cedula").fill("30540767");
    await page.getByRole("button", { name: /buscar/i }).click();
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await expect(page.getByText("HITLER MOISES")).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/2_seguridad_modificar.png` });
  });

  test("3. /usuarios/registrar muestra tarjeta y formulario de registro", async ({ page }) => {
    await page.goto("/usuarios/registrar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Registrar Usuarios" })).toBeVisible();
    await expect(page.getByText("Registrar Como Usuario A Un Trabajador")).toBeVisible();
    await expect(page.getByLabel("Cedula")).toBeVisible();
    await expect(page.getByLabel("Contraseña", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Usuario" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/3_seguridad_registrar.png` });
  });

  test("4. /usuarios/roles muestra tabla de roles y acciones", async ({ page }) => {
    await page.goto("/usuarios/roles");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "ID" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Nombre Del Rol" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/4_seguridad_roles.png` });
  });

  test("5. /usuarios/roles/registrar muestra formulario de registro de rol", async ({ page }) => {
    await page.goto("/usuarios/roles/registrar");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

    await expect(page.getByRole("heading", { name: "Registrar Roles" })).toBeVisible();
    await expect(page.getByText("Registrar Un Nuevo Rol En El Sistema")).toBeVisible();
    await expect(page.getByLabel("Nombre Del Rol")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar Rol" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/5_seguridad_roles_registrar.png` });
  });
});
