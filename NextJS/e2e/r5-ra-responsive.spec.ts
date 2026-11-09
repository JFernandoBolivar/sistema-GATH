import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";



const BIEN_EMAIL = process.env.E2E_BIEN_EMAIL;
const BIEN_PASSWORD = process.env.E2E_BIEN_PASSWORD;
const TRAB_EMAIL = process.env.E2E_TRAB_EMAIL;
const TRAB_PASSWORD = process.env.E2E_TRAB_PASSWORD;
const PASIVO_EMAIL = process.env.E2E_PASIVO_EMAIL;
const PASIVO_PASSWORD = process.env.E2E_PASIVO_PASSWORD;

const ANCHOS = [360, 390, 768] as const;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel(/correo electr/i).fill(email);
  await page.getByLabel(/contrase/i).fill(password);
  await page.locator("form").evaluate((f) => (f as HTMLFormElement).requestSubmit());
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
}

async function revisar(page: Page, ruta: string) {
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 844 });
    await page.goto(ruta);
    await page.waitForLoadState("networkidle").catch(() => {});

    const desborde = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const fuera = Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((el) => {
          if (el.closest('[role="region"][aria-label]') || el.closest("table")) return false;
          let padre: HTMLElement | null = el.parentElement;
          while (padre) {
            const estilo = getComputedStyle(padre);
            if (estilo.overflowX === "auto" || estilo.overflowX === "scroll") return false;
            padre = padre.parentElement;
          }
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        })
        .slice(0, 5)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`);
      return { vw, scroll: document.documentElement.scrollWidth, fuera };
    });
    expect(desborde.scroll, `${ruta} ${ancho}px scroll`).toBeLessThanOrEqual(desborde.vw + 1);
    expect(desborde.fuera, `${ruta} ${ancho}px elementos fuera: ${desborde.fuera.join(" | ")}`).toEqual([]);

    const tabla = page.locator("table").first();
    if (await tabla.count()) {
      const region = page.locator('[role="region"][aria-label]').first();
      await expect(region).toHaveAttribute("tabindex", "0");
      await expect(region).toHaveAttribute("aria-label", /.+/);
    }

    const input = page.locator("input:visible").first();
    if (await input.count()) {
      const size = await input.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
      expect(size, `${ruta} input 16px`).toBeGreaterThanOrEqual(16);
    }
  }
}

async function axe(page: Page, rutas: string[]) {
  for (const ruta of rutas) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ruta);
    await page.waitForLoadState("networkidle").catch(() => {});
    const r = await new AxeBuilder({ page }).analyze();
    const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      graves,
      `${ruta}: ${JSON.stringify(graves.map((v) => ({ id: v.id, nodos: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
}

test.describe("R-5/R-A — Bienestar", () => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan credenciales E2E de Bienestar");
  test("responsive y axe en Gestión y Bienestar", async ({ page }) => {
    test.setTimeout(600_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await login(page, BIEN_EMAIL as string, BIEN_PASSWORD as string);
    const rutas = [
      "/personal",
      "/personal/consultar",
      "/personal/bienestar/solicitudes",
      "/personal/fe-de-vida",
      "/personal/fe-de-vida/procesos",
      "/personal/fe-de-vida/cobertura",
      "/autogestion/solicitudes",
      "/autogestion/consultar",
    ];
    for (const ruta of rutas) await revisar(page, ruta);
    await axe(page, rutas);
  });
});

test.describe("R-5/R-A — trabajador", () => {
  test.skip(!TRAB_EMAIL || !TRAB_PASSWORD, "faltan credenciales E2E del trabajador");
  test("responsive y axe en Autogestión", async ({ page }) => {
    test.setTimeout(400_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await login(page, TRAB_EMAIL as string, TRAB_PASSWORD as string);
    const rutas = [
      "/autogestion",
      "/autogestion/ficha",
      "/autogestion/solicitudes/nueva",
      "/autogestion/censo",
    ];
    for (const ruta of rutas) await revisar(page, ruta);
    await axe(page, rutas);
  });
});

test.describe("R-5/R-A — pasivo", () => {
  test.skip(!PASIVO_EMAIL || !PASIVO_PASSWORD, "faltan credenciales E2E del pasivo");
  test("responsive y axe en fe de vida", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await login(page, PASIVO_EMAIL as string, PASIVO_PASSWORD as string);
    await revisar(page, "/autogestion/fe-de-vida");
    await axe(page, ["/autogestion/fe-de-vida"]);
  });
});

test("axe en login y recuperación", async ({ page }) => {
  test.setTimeout(180_000);
  for (const ruta of ["/login", "/recuperar-password"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ruta);
    const r = await new AxeBuilder({ page }).analyze();
    const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      graves,
      `${ruta}: ${JSON.stringify(graves.map((v) => ({ id: v.id, nodos: v.nodes.map((n) => n.target) })))}`,
    ).toEqual([]);
  }
});

test("texto al 200% sin scroll horizontal", async ({ page }) => {
  test.skip(!BIEN_EMAIL || !BIEN_PASSWORD, "faltan credenciales E2E de Bienestar");
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, BIEN_EMAIL as string, BIEN_PASSWORD as string);
  for (const ruta of ["/personal", "/personal/consultar"]) {
    await page.goto(ruta);
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "32px";
    });
    const datos = await page.evaluate(() => ({
      vw: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(datos.scroll, `${ruta} al 200%`).toBeLessThanOrEqual(datos.vw + 1);
  }
});
