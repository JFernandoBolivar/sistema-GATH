import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * A-T2 · Notificaciones por módulo (Fase 3). Solo lectura: no cambia contraseñas ni marca nada.
 * Credenciales solo por entorno (R15): E2E_BIEN_* (Bienestar) y E2E_TRAB_* (trabajador).
 */
async function sinGraves(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  const r = await new AxeBuilder({ page }).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    graves,
    JSON.stringify(graves.map((v) => ({ id: v.id, nodos: v.nodes.map((n) => n.target) }))),
  ).toEqual([]);
}

const PERFILES = [
  {
    id: "bienestar",
    email: process.env.E2E_BIEN_EMAIL,
    password: process.env.E2E_BIEN_PASSWORD,
    inicio: "/personal",
    bandeja: "/personal/notificaciones",
  },
  {
    id: "trabajador",
    email: process.env.E2E_TRAB_EMAIL,
    password: process.env.E2E_TRAB_PASSWORD,
    inicio: "/autogestion",
    bandeja: "/autogestion/notificaciones",
  },
];

for (const p of PERFILES) {
  test.describe(`Notificaciones · ${p.id}`, () => {
    test.skip(!p.email || !p.password, `Faltan credenciales E2E del perfil ${p.id}`);
    test.describe.configure({ mode: "serial" });
    let page: Page;
    const errores: string[] = [];

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
      page = await context.newPage();
      page.on("pageerror", (e) => errores.push(e.message));
      await iniciarSesionComo(page, p.email ?? "", p.password ?? "");
    });
    test.afterAll(async () => {
      await page?.context().close();
    });

    test("la campana lleva a la bandeja del módulo con «Ver todas»", async () => {
      await page.goto(p.inicio);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.getByRole("button", { name: /^Notificaciones:/ }).filter({ visible: true }).first().click();
      const ver = page.getByRole("link", { name: "Ver todas" });
      await expect(ver).toBeVisible({ timeout: 30_000 });
      await ver.click();
      await expect(page).toHaveURL(new RegExp(`${p.bandeja}$`), { timeout: 30_000 });
    });

    test("la bandeja carga con filtros y paginación, sin errores ni violaciones axe", async () => {
      await page.goto(p.bandeja);
      await expect(page.getByRole("heading", { name: /notificaciones/i }).first()).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByRole("search", { name: /filtros de notificaciones/i }).or(
        page.getByLabel("Filtros de notificaciones"),
      ).first()).toBeVisible();
      await expect(page.getByText(/ninguna notificación|no tiene notificaciones|Página \d+ de \d+|Lista/i).first()).toBeVisible();
      if (await page.getByLabel("Paginación de notificaciones").count()) {
        await expect(page.getByLabel("Paginación de notificaciones")).toContainText(/Página 1 de/);
      }
      await expect(page.getByText(/no se pudieron cargar/i)).toHaveCount(0);
      await sinGraves(page);
      expect(errores).toEqual([]);
    });

    test("«Cambiar contraseña» abre el diálogo y se cierra sin cambiar nada", async () => {
      await page.goto(p.inicio);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.getByRole("button", { name: "Cambiar contraseña" }).filter({ visible: true }).first().click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await expect(dialogo).toBeHidden();
    });
  });
}

test.describe("Menú de Bienestar", () => {
  test.skip(!process.env.E2E_BIEN_EMAIL || !process.env.E2E_BIEN_PASSWORD, "Faltan credenciales E2E_BIEN_*");
  test("existe la entrada «Notificaciones» y lleva a la bandeja de /personal", async ({ page }) => {
    await iniciarSesionComo(page, process.env.E2E_BIEN_EMAIL ?? "", process.env.E2E_BIEN_PASSWORD ?? "");
    await page.goto("/personal");
    await page.waitForLoadState("networkidle").catch(() => {});
    const enlace = page.locator('a[href="/personal/notificaciones"]').filter({ hasText: /^\s*Notificaciones/ });
    await expect(enlace.first()).toBeAttached({ timeout: 30_000 });
  });
});
