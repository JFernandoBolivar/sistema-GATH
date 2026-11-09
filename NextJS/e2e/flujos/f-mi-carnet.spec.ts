import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { entrar, ir, paso, vigilar } from "./helpers";

const TRAB_EMAIL = process.env.E2E_TRAB_EMAIL ?? "";
const TRAB_PASSWORD = process.env.E2E_TRAB_PASSWORD ?? "";

type Alcance = "nadie" | "todos" | "activos" | "pasivos" | "usuarios_especificos";

/** Cambia el parámetro de alcance de Mi Carnet en la BD de ejecución. */
function fijarAlcance(alcance: Alcance): void {
  const guion = [
    "from apps.configuracion.domain.parametros import definicion_de",
    "from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel",
    "d = definicion_de('carnetizacion.mi_carnet_alcance')",
    `ParametroSistemaModel.objects.update_or_create(clave='carnetizacion.mi_carnet_alcance', defaults={'valor': '${alcance}', 'etiqueta': d.etiqueta, 'descripcion': d.descripcion, 'grupo': d.grupo, 'tipo': d.tipo})`,
    "from django.core.cache import cache",
    "cache.clear()",
    "print(1)",
  ].join("; ");
  const salida = execFileSync(
    "docker",
    ["exec", "django-App", "python", "manage.py", "shell", "-c", guion],
    { encoding: "utf8" },
  );
  const lineas = salida.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lineas[lineas.length - 1] !== "1") {
    throw new Error(`No se pudo fijar carnetizacion.mi_carnet_alcance=${alcance}`);
  }
}

/**
 * Flujo F: Mi carnet en Autogestión.
 * D3/FIX-O46: el ítem del menú y la pestaña solo aparecen con
 * `puede_ver_carnet=true`; con alcance `nadie` la URL muestra un estado vacío
 * claro. El parámetro se restaura a `nadie` al terminar.
 */
test.describe("F · Mi carnet en Autogestión", () => {
  test("respeta el alcance del backend y muestra la credencial", async ({ page }, info) => {
    test.setTimeout(300_000);
    const vigilante = vigilar(page);
    const incidencias: string[] = [];
    const anotar = (r: { problemas: string[] }) => incidencias.push(...r.problemas);

    try {
      // 1) Alcance nadie: menú oculto y estado vacío claro en la URL directa.
      fijarAlcance("nadie");
      await entrar(page, TRAB_EMAIL, TRAB_PASSWORD);
      anotar(await paso(page, info, vigilante, "F", "01-sesion-iniciada"));

      await ir(page, "/autogestion/mi-carnet");
      const enlaceMenu = page.getByRole("link", { name: /Mi carnet/i });
      const menuVisible = (await enlaceMenu.count()) > 0;
      const vacioVisible = await page
        .getByText(/no está habilitada|aún no está habilitado/i)
        .first()
        .isVisible()
        .catch(() => false);
      if (menuVisible) {
        incidencias.push("Con alcance 'nadie' el menú sigue mostrando «Mi carnet».");
      }
      if (!vacioVisible) {
        incidencias.push(
          "Con alcance 'nadie' /autogestion/mi-carnet no muestra el estado vacío esperado.",
        );
      }
      anotar(await paso(page, info, vigilante, "F", "02-nadie-menu-oculto"));

      // 2) Alcance todos: menú, pestaña y tarjeta del carnet visibles.
      fijarAlcance("todos");
      await entrar(page, TRAB_EMAIL, TRAB_PASSWORD);
      await ir(page, "/autogestion/mi-carnet");
      await expect(page.getByText(/Mi Credencial Digital/i)).toBeVisible({
        timeout: 30_000,
      });
      let menuConAcceso = await page
        .getByRole("link", { name: /Mi carnet/i })
        .isVisible()
        .catch(() => false);
      if (!menuConAcceso) {
        // En teléfono el sidebar está plegado; se abre para comprobar el ítem.
        const trigger = page.getByRole("button", { name: /Toggle Sidebar/i }).first();
        if (await trigger.isVisible().catch(() => false)) {
          await trigger.click();
          await page.waitForTimeout(400);
          menuConAcceso = await page
            .getByRole("link", { name: /Mi carnet/i })
            .isVisible()
            .catch(() => false);
        }
      }
      if (!menuConAcceso) {
        incidencias.push(
          "Con alcance 'todos' no aparece «Mi carnet» en el menú.",
        );
      }
      await expect(page.getByText(/Activo y Vigente/i).first()).toBeVisible({
        timeout: 30_000,
      });
      anotar(await paso(page, info, vigilante, "F", "03-todos-carnet-visible"));
    } finally {
      // Restaura el valor por defecto del sistema.
      try {
        fijarAlcance("nadie");
      } catch (error) {
        incidencias.push(`No se pudo restaurar mi_carnet_alcance=nadie: ${String(error)}`);
      }
    }

    expect
      .soft(incidencias, `Incidencias del flujo F:\n${incidencias.join("\n")}`)
      .toEqual([]);
  });
});
