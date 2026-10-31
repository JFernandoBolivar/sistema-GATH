import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Accesibilidad (axe) de las pantallas de autogestión Fase 2. Criterio: 0 violaciones
 * serious/critical. Solo lectura (no crea solicitudes). Credenciales solo por entorno (R15):
 * E2E_TRAB_EMAIL/PASSWORD (trabajador ACTIVO) y E2E_BIEN_EMAIL/PASSWORD (Bienestar).
 * Los detalles se prueban solo si el perfil ya tiene alguna solicitud.
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

async function detalleDesdeLista(page: Page, lista: string, patron: RegExp) {
  await page.goto(lista);
  await page.waitForLoadState("networkidle").catch(() => {});
  const hrefs = await page.locator(`a[href^="${lista}/"]`).evaluateAll((els) =>
    els.map((e) => e.getAttribute("href") ?? ""),
  );
  const href = hrefs.find((h) => patron.test(h)) ?? null;
  return href;
}

const PERFILES = [
  {
    id: "trabajador",
    email: process.env.E2E_TRAB_EMAIL,
    password: process.env.E2E_TRAB_PASSWORD,
    rutas: [
      ["/autogestion", /buenos|buenas/i],
      ["/autogestion/ficha", /Identificación/i],
      ["/autogestion/solicitudes", /Mis solicitudes/i],
      ["/autogestion/solicitudes/nueva", /Solicitar actualización de datos/i],
    ] as const,
    lista: "/autogestion/solicitudes",
    detalle: /\/autogestion\/solicitudes\/\d+/,
  },
  {
    id: "bienestar",
    email: process.env.E2E_BIEN_EMAIL,
    password: process.env.E2E_BIEN_PASSWORD,
    rutas: [["/personal/bienestar/solicitudes", /Solicitudes de actualización de datos/i]] as const,
    lista: "/personal/bienestar/solicitudes",
    detalle: /\/personal\/bienestar\/solicitudes\/\d+/,
  },
];

for (const p of PERFILES) {
  test.describe(`Accesibilidad · ${p.id}`, () => {    test.skip(!p.email || !p.password, `Faltan credenciales E2E del perfil ${p.id}`);
    test.describe.configure({ mode: "serial" });
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
      page = await context.newPage();
      await iniciarSesionComo(page, p.email ?? "", p.password ?? "");
    });
    test.afterAll(async () => {
      await page?.context().close();
    });

    for (const [ruta, espera] of p.rutas) {
      test(`${ruta} sin violaciones serious/critical`, async () => {
        await page.goto(ruta);
        await expect(page.getByText(espera).filter({ visible: true }).first()).toBeVisible({ timeout: 45_000 });
        await sinGraves(page);
      });
    }

    test(`detalle de solicitud (${p.id}) sin violaciones serious/critical`, async () => {
      const href = await detalleDesdeLista(page, p.lista, p.detalle);
      test.skip(!href, "No hay solicitudes para abrir un detalle");
      await page.goto(href as string);
      await page.waitForLoadState("networkidle").catch(() => {});
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 45_000 });
      await sinGraves(page);
    });
  });
}

test.describe("Accesibilidad · Administración del sistema (D9/D10)", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
    page = await context.newPage();
    await iniciarSesionComo(page, EMAIL, PASSWORD);
  });
  test.afterAll(async () => {
    await page?.context().close();
  });

  for (const [ruta, espera] of [
    ["/configuracion/parametros", /Parámetros del sistema/i],
    ["/auditoria", /Bitácora de auditoría/i],
  ] as const) {
    test(`${ruta} sin violaciones serious/critical`, async () => {
      await page.goto(ruta);
      await expect(page.getByText(espera).first()).toBeVisible({ timeout: 45_000 });
      await sinGraves(page);
    });
  }
});
