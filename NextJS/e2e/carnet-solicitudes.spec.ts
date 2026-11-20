import { expect, test, type Page } from "@playwright/test";

import { EMAIL, PASSWORD } from "./credenciales";
import { iniciarSesionComo } from "./inicio-sesion";

/**
 * Solicitudes de carnet (seguimiento A-6, decisión del 2026-11-20): el trabajador SOLICITA desde
 * Autogestión › Mi carnet y Recursos Humanos aprueba (emite) o rechaza desde la bandeja.
 *
 * Recorre el ciclo completo con UN usuario que es a la vez trabajador y RRHH. Por eso es opcional:
 * solo corre con E2E_SOLICITUD_CARNET=1 y exige preparar antes, en una base de prueba:
 *  - el usuario E2E con condición ACTIVA o PASIVA (sin asignación no puede solicitar), y
 *  - «Mi carnet» habilitado para él (parámetros carnetizacion.mi_carnet_alcance /
 *    carnetizacion.mi_carnet_usuarios), sin carnet activo ni solicitud pendiente.
 * Ojo: emite un carnet real para ese usuario.
 */
test.skip(process.env.E2E_SOLICITUD_CARNET !== "1", "Requiere E2E_SOLICITUD_CARNET=1 y la preparación descrita.");

const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

async function cedulaDeLaSesion(page: Page): Promise<string> {
  const token = (await page.context().cookies()).find((c) => c.name === "dj_access")?.value;
  const respuesta = await page.request.get(`${DJANGO}/api/v1/autogestion/mi-expediente/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const cuerpo = (await respuesta.json()) as { data?: { empleado?: { cedula?: string } } };
  const cedula = String(cuerpo.data?.empleado?.cedula ?? "");
  expect(cedula, "la sesión E2E debe tener expediente de trabajador").not.toBe("");
  return cedula;
}

async function solicitar(page: Page, texto: string) {
  await page.goto("/autogestion/mi-carnet");
  await page.getByRole("button", { name: /solicitar mi carnet/i }).click();
  await page.getByRole("dialog").locator("textarea").fill(texto);
  await page.getByRole("button", { name: /enviar solicitud/i }).click();
  await expect(page.getByText(/solicitud en revisión por recursos humanos/i)).toBeVisible();
  // Mientras está en revisión no se puede enviar otra.
  await expect(page.getByRole("button", { name: /solicitud en revisión/i })).toBeDisabled();
}

async function abrirDictamen(page: Page, cedula: string) {
  await page.goto("/carnetizacion/solicitudes");
  const fila = page.locator("tr").filter({ hasText: cedula }).filter({ hasText: "Pendiente" }).first();
  await fila.getByRole("button", { name: /dictaminar/i }).click();
  await expect(page.getByText("Dictamen de Solicitud de Credencial")).toBeVisible();
}

test("solicitar, rechazar con motivo, volver a solicitar y aprobar", async ({ page }) => {
  page.setDefaultTimeout(30_000);
  await iniciarSesionComo(page, EMAIL, PASSWORD);
  const cedula = await cedulaDeLaSesion(page);

  await solicitar(page, "E2E: primera solicitud");

  await abrirDictamen(page, cedula);
  await page.getByRole("button", { name: /rechazar solicitud/i }).click();
  // Sin motivo no se rechaza.
  await expect(page.getByText("Dictamen de Solicitud de Credencial")).toBeVisible();
  await page.getByPlaceholder(/motivo obligatorio en caso de rechazo/i).fill("La foto no cumple el formato");
  await page.getByRole("button", { name: /rechazar solicitud/i }).click();
  await expect(page.getByText(/rechazada; se notificó/i)).toBeVisible();

  await page.goto("/autogestion/mi-carnet");
  await expect(page.getByText(/fue rechazada/i)).toBeVisible();
  await expect(page.getByText(/la foto no cumple el formato/i)).toBeVisible();

  await solicitar(page, "E2E: segunda solicitud");
  await abrirDictamen(page, cedula);
  const descarga = page.waitForEvent("download");
  await page.getByRole("button", { name: /aprobar y emitir carnet/i }).click();
  expect((await descarga).suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByText(/credencial emitida y trabajador notificado/i)).toBeVisible();

  await page.goto("/autogestion/mi-carnet");
  await expect(page.getByText(/carnet activo y vigente/i)).toBeVisible();
});
