import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

/**
 * Bandeja de Captación (D-7) y psicofísico (D-8), con el admin E2E (ADMINISTRADOR: tiene los permisos
 * `postulacion.*`). El postulante entra y envía la Ventana 1 por API (más estable que su UI, ya cubierta
 * en `postulacion-acceso.spec.ts`). Se corre en escritorio y en teléfono (390x844).
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 } },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 } },
] as const;

function cedulaAleatoria(): string {
  return `19${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

function hoyEnCaracas(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
}

async function esperarHidratacion(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

/** Fila (escritorio) o tarjeta (teléfono) de ESA cédula: no depende de otros expedientes de la base. */
function filaDe(page: Page, cedula: string, ancho: number) {
  return ancho >= 768
    ? page.getByRole("row").filter({ hasText: cedula })
    : page.getByRole("link").filter({ hasText: cedula });
}

/** El postulante entra con la clave temporal, la cambia, completa lo obligatorio y envía la Ventana 1. */
async function postulanteEnviaVentana1(request: APIRequestContext, cedula: string, claveTemporal: string) {
  const claveNueva = "Clave2026Segura";
  const acceso = await request.post(`${DJANGO}/api/v1/postulacion/acceso/`, {
    data: { cedula, password: claveTemporal },
  });
  expect(acceso.ok(), `acceso del postulante: HTTP ${acceso.status()}`).toBeTruthy();
  const tokenInicial = ((await acceso.json()) as { data: { token: string } }).data.token;

  const cambio = await request.post(`${DJANGO}/api/v1/postulacion/cambiar-clave/`, {
    headers: { Authorization: `Bearer ${tokenInicial}` },
    data: { clave_actual: claveTemporal, clave_nueva: claveNueva },
  });
  expect(cambio.ok(), `cambio de clave: HTTP ${cambio.status()}`).toBeTruthy();
  const token = ((await cambio.json()) as { data: { token: string } }).data.token;
  const cabeceras = { Authorization: `Bearer ${token}` };

  const borrador = await request.put(`${DJANGO}/api/v1/postulacion/borrador/`, {
    headers: cabeceras,
    data: {
      nombres: "Prueba",
      apellidos: "Captacion Bandeja",
      datos_ventana1: { fecha_nacimiento: "1994-03-15", sexo: "F", nacionalidad: "V" },
    },
  });
  expect(borrador.ok(), `borrador: HTTP ${borrador.status()}`).toBeTruthy();

  const envio = await request.post(`${DJANGO}/api/v1/postulacion/enviar/`, { headers: cabeceras });
  expect(envio.ok(), `envío: HTTP ${envio.status()}`).toBeTruthy();
}

for (const { nombre, viewport } of VISTAS) {
  test(`captación: alta, bandeja, psicofísico y devolución con motivo (${nombre})`, async ({ browser }) => {
    test.setTimeout(180_000);
    const contexto = await browser.newContext({ viewport });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);

    try {
      await iniciarSesionE2E(page);

      // 1. Bandeja: pestañas y botón «Nuevo postulante».
      await page.goto("/captacion");
      await page.waitForURL(/\/captacion\/expedientes/);
      await esperarHidratacion(page);
      await expect(page.getByRole("heading", { name: /bandeja de captación/i })).toBeVisible();
      for (const pestana of [/por revisar/i, /en corrección/i, /en presupuesto/i, /todos/i]) {
        await expect(page.getByRole("tab", { name: pestana })).toBeVisible();
      }

      // 2. Crear el postulante desde la UI: la credencial aparece una sola vez.
      const cedula = cedulaAleatoria();
      await page.getByRole("button", { name: /nuevo postulante/i }).click();
      const dialogo = page.getByRole("dialog");
      await dialogo.getByLabel(/cédula de identidad/i).fill(cedula);
      await dialogo.getByLabel(/nombres/i).fill("Prueba");
      await dialogo.getByLabel(/apellidos/i).fill("Captacion Bandeja");
      await dialogo.getByRole("button", { name: /crear postulante/i }).click();

      const clave = (await dialogo.getByTestId("credencial-clave").textContent())?.trim() ?? "";
      expect(clave.length, "la credencial trae la contraseña temporal").toBeGreaterThan(5);
      await expect(dialogo.getByTestId("credencial-usuario")).toHaveText(cedula);
      await expect(dialogo.getByText(/no se volverá a mostrar/i)).toBeVisible();
      await expect(dialogo.getByRole("button", { name: /copiar contraseña temporal/i })).toBeVisible();
      await dialogo.getByRole("button", { name: /ya la entregué/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText(clave, { exact: true })).toHaveCount(0);

      // 3. El postulante completa y envía la Ventana 1 (por API).
      await postulanteEnviaVentana1(page.request, cedula, clave);

      // 4. Aparece en «Por revisar».
      await page.reload();
      await esperarHidratacion(page);
      await page.getByRole("tab", { name: /por revisar/i }).click();
      await page.getByLabel(/buscar por cédula/i).fill(cedula);
      const fila = filaDe(page, cedula, viewport.width);
      await expect(fila).toHaveCount(1, { timeout: 30_000 });
      await expect(fila.getByText("Por revisar", { exact: true })).toBeVisible();
      await (viewport.width >= 768 ? fila.getByRole("link") : fila).click();

      // 5. Detalle: «Abrir hacia Presupuesto» bloqueada por el psicofísico, con su motivo a la vista.
      await page.waitForURL(/\/captacion\/expedientes\/[0-9a-f-]{36}/);
      await esperarHidratacion(page);
      await expect(page.getByText(`C.I. ${cedula}`)).toBeVisible();
      const abrir = page.getByRole("button", { name: /abrir hacia presupuesto/i });
      await expect(abrir).toBeDisabled();
      await expect(page.getByText(/psicof/i).first()).toBeVisible();

      // Datos legibles de la Ventana 1.
      await expect(page.getByText("Femenino")).toBeVisible();

      // 6. Registrar el psicofísico APTO: desbloquea la apertura hacia Presupuesto.
      await page.getByRole("tab", { name: /psicofísico/i }).click();
      await page.getByRole("radio", { name: "Apto", exact: true }).check();
      await page.getByLabel(/fecha de aplicación/i).fill(hoyEnCaracas());
      await page.getByRole("button", { name: /registrar resultado/i }).click();
      await expect(page.getByText(/resultado psicofísico registrado/i).first()).toBeVisible();
      await expect(page.getByText("Resultado registrado")).toBeVisible();
      await expect(abrir).toBeEnabled();

      // 7. Devolver con observaciones: motivo obligatorio, cambia el estado y queda en el historial.
      const motivo = "Falta completar la dirección de habitación del postulante.";
      await page.getByRole("button", { name: /devolver con observaciones/i }).click();
      const dlgMotivo = page.getByRole("dialog");
      await dlgMotivo.getByRole("button", { name: /devolver con observaciones/i }).click();
      await expect(dlgMotivo.getByText(/el motivo es obligatorio/i)).toBeVisible();
      await dlgMotivo.getByLabel(/motivo/i).fill(motivo);
      await dlgMotivo.getByRole("button", { name: /devolver con observaciones/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByText("Devuelto al postulante").first()).toBeVisible();

      await page.getByRole("tab", { name: /historial/i }).click();
      await expect(page.getByText(new RegExp(motivo.slice(0, 30)))).toBeVisible();
      await expect(page.getByRole("list", { name: /historial de estados/i })).toBeVisible();

      // 8. En la bandeja pasa a «En corrección».
      await page.goto("/captacion/expedientes");
      await esperarHidratacion(page);
      await page.getByRole("tab", { name: /en corrección/i }).click();
      await page.getByLabel(/buscar por cédula/i).fill(cedula);
      await expect(filaDe(page, cedula, viewport.width).getByText("Devuelto al postulante")).toBeVisible({ timeout: 30_000 });
    } finally {
      await contexto.close();
    }
  });
}
