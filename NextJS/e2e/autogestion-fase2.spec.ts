import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Fase 2 (autogestión): expectativas POR PERFIL, cada una con sus credenciales de entorno (R15):
 *  - TRABAJADOR (ACTIVO, rol AUTOGESTION): E2E_TRAB_EMAIL / E2E_TRAB_PASSWORD.
 *  - BIENESTAR (ANALISTA_BIENESTAR, SIN_ASIGNACION): E2E_BIEN_EMAIL / E2E_BIEN_PASSWORD.
 * Un perfil sin credenciales se omite. Cada pantalla que el perfil sí ve pasa axe (sin violaciones
 * graves) y no desborda en horizontal; lo que no le corresponde se verifica como bloqueo/redirección.
 * No ejecuta el flujo completo solicitar → habilitar → enviar → decidir (cubierto por Vitest).
 *
 * Capturas: E2E_CAPTURAS_DIR (carpeta de salida; sin ella no se guardan).
 */
const CAPTURAS = process.env.E2E_CAPTURAS_DIR;

const VIEWPORTS = [
  { nombre: "escritorio", viewport: { width: 1366, height: 800 } },
  { nombre: "movil", viewport: { width: 390, height: 844 } },
] as const;

interface Pantalla {
  nombre: string;
  ruta: string;
  espera: RegExp;
}

const INICIO = { nombre: "inicio", ruta: "/autogestion", espera: /buenos|buenas/i };
const FICHA = { nombre: "ficha", ruta: "/autogestion/ficha", espera: /Identificación/i };
const NUEVA = {
  nombre: "nueva-solicitud",
  ruta: "/autogestion/solicitudes/nueva",
  espera: /Solicitar actualización de datos/i,
};
const MIS_SOLICITUDES = {
  nombre: "mis-solicitudes",
  ruta: "/autogestion/solicitudes",
  espera: /Mis solicitudes/i,
};
const BANDEJA = {
  nombre: "bandeja-bienestar",
  ruta: "/personal/bienestar/solicitudes",
  espera: /Solicitudes de actualización de datos/i,
};

async function revisar(page: Page, p: Pantalla, perfil: string, vista: string) {
  await page.waitForLoadState("networkidle").catch(() => {});
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/fase2_${p.nombre}_${perfil}_${vista}.png`, fullPage: true });
  const resultados = await new AxeBuilder({ page }).analyze();
  const graves = resultados.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    graves,
    JSON.stringify(graves.map((v) => ({ id: v.id, nodos: v.nodes.map((n) => n.target) }))),
  ).toEqual([]);
  // Sin desbordamiento horizontal de la página
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(desborda).toBe(false);
}

async function abrirSesion(browser: Browser, email: string, password: string, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, baseURL: process.env.E2E_BASE_URL });
  const page = await context.newPage();
  await iniciarSesionComo(page, email, password);
  return { context, page };
}

interface PerfilE2E {
  id: string;
  email?: string;
  password?: string;
  /** Pantallas que el perfil ve: cargan, sin errores de página y sin violaciones graves de axe. */
  visibles: Pantalla[];
  /** Comprobaciones propias del perfil (bloqueos, estados no disponibles). */
  extra: (pagina: () => Page) => void;
}

const PERFILES: PerfilE2E[] = [
  {
    id: "trabajador",
    email: process.env.E2E_TRAB_EMAIL,
    password: process.env.E2E_TRAB_PASSWORD,
    visibles: [INICIO, FICHA, NUEVA, MIS_SOLICITUDES],
    extra: (pagina) => {
      test("la bandeja de Bienestar está bloqueada: redirige a Autogestión sin cargarla", async () => {
        const page = pagina();
        await page.goto(BANDEJA.ruta);
        await expect(page).toHaveURL(/\/autogestion\/?$/);
        await expect(page.getByText(BANDEJA.espera)).toHaveCount(0);
      });
    },
  },
  {
    id: "bienestar",
    email: process.env.E2E_BIEN_EMAIL,
    password: process.env.E2E_BIEN_PASSWORD,
    visibles: [BANDEJA, INICIO, FICHA, MIS_SOLICITUDES],
    extra: (pagina) => {
      test("sin condición ACTIVO: «Solicitar actualización» no está disponible", async () => {
        const page = pagina();
        await page.goto(NUEVA.ruta);
        await expect(page.getByText(/no está disponible para su condición/i)).toBeVisible({ timeout: 45_000 });
        await expect(page.getByRole("button", { name: /enviar solicitud/i })).toHaveCount(0);
      });

      test("la ficha propia no muestra el botón de solicitar actualización", async () => {
        const page = pagina();
        await page.goto(FICHA.ruta);
        await expect(page.getByText(FICHA.espera).first()).toBeVisible({ timeout: 45_000 });
        await expect(page.getByRole("link", { name: /solicitar actualización de mis datos/i })).toHaveCount(0);
      });
    },
  },
];

for (const perfil of PERFILES) {
  for (const { nombre: vista, viewport } of VIEWPORTS) {
    test.describe(`Fase 2 · ${perfil.id} · ${vista}`, () => {
      test.skip(!perfil.email || !perfil.password, `Faltan credenciales E2E del perfil ${perfil.id}`);
      test.describe.configure({ mode: "serial", timeout: 120_000 });

      let page: Page;
      let cerrar: () => Promise<void>;
      const errores: string[] = [];

      test.beforeAll(async ({ browser }) => {
        const sesion = await abrirSesion(browser, perfil.email ?? "", perfil.password ?? "", viewport);
        page = sesion.page;
        cerrar = () => sesion.context.close();
        page.on("pageerror", (e) => errores.push(e.message));
      });
      test.beforeEach(() => {
        errores.length = 0;
      });
      test.afterAll(async () => {
        await cerrar?.();
      });

      for (const pantalla of perfil.visibles) {
        test(`${pantalla.ruta} carga sin errores y sin violaciones graves de axe`, async () => {
          await page.goto(pantalla.ruta);
          await expect(page.getByText(pantalla.espera).first()).toBeVisible({ timeout: 45_000 });
          await revisar(page, pantalla, perfil.id, vista);
          expect(errores).toEqual([]);
        });
      }

      perfil.extra(() => page);
    });
  }
}
