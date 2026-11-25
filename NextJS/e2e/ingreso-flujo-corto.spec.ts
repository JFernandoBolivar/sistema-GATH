import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";
import { API, DJANGO, PDF_MINIMO, cedulaAleatoria, esperarHidratacion, hoyEnCaracas, postulanteEnviaVentana1, sinDesbordeHorizontal, type Sobre } from "./ventana2-api";

/**
 * M-5 · Captación con el flujo corto (sin Presupuesto y sin Dirección General en el sistema).
 *
 * Con los dos parámetros del proceso de ingreso en «false» (por API, y RESTAURADOS en el `finally`), se prepara
 * por API un expediente hasta ENVIADO_CAPTACION con psicofísico APTO y, en la UI de Captación, se reserva el
 * puesto, se genera el Punto de Cuenta (con descarga) y se registra la aprobación con la fecha de la firma.
 *  - escritorio: sin PDF firmado (después se adjunta desde «Adjuntar el Punto de Cuenta firmado»);
 *  - móvil 390x844: con un PDF de prueba pequeño.
 * No contrata. La reserva queda ACTIVA por diseño hasta la asignación: el test anota expediente y puesto.
 */
const CLAVES = ["captacion.requiere_presupuesto", "captacion.requiere_direccion_general"] as const;
const CAPTURAS = process.env.E2E_CAPTURAS ?? "";

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 }, conPdf: false },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 }, conPdf: true },
] as const;

async function ponerFlag(request: APIRequestContext, admin: Record<string, string>, clave: string, valor: "true" | "false") {
  const r = await request.put(`${DJANGO}/api/v1/configuracion/parametros/${clave}/`, { headers: admin, data: { valor } });
  expect(r.ok(), `parámetro ${clave}=${valor}: HTTP ${r.status()}`).toBeTruthy();
}

async function valorFlag(request: APIRequestContext, admin: Record<string, string>, clave: string): Promise<string> {
  const r = await request.get(`${DJANGO}/api/v1/configuracion/parametros/`, { headers: admin });
  const lista = ((await r.json()) as Sobre<{ clave: string; valor: string }[]>).data;
  return lista.find((p) => p.clave === clave)?.valor ?? "";
}

/** Alta, datos iniciales y psicofísico APTO: el expediente queda en ENVIADO_CAPTACION (sin abrir hacia Presupuesto). */
async function prepararEnCaptacion(request: APIRequestContext, admin: Record<string, string>) {
  const cedula = cedulaAleatoria();
  const alta = await request.post(`${API}/postulantes/`, {
    headers: admin,
    data: { cedula, nombres: "Prueba", apellidos: "Flujo Corto", correo: `fc${cedula}@ejemplo.invalid` },
  });
  expect(alta.ok(), `alta del postulante: HTTP ${alta.status()}`).toBeTruthy();
  const cuerpo = ((await alta.json()) as Sobre<{ expediente: { id: string; numero: string }; credencial: { clave_temporal: string } }>).data;
  await postulanteEnviaVentana1(request, cedula, cuerpo.credencial.clave_temporal);
  const psico = await request.post(`${API}/expedientes/${cuerpo.expediente.id}/psicofisico/`, {
    headers: admin,
    multipart: { resultado: "APTO", fecha_aplicacion: hoyEnCaracas() },
  });
  expect(psico.ok(), `psicofísico: HTTP ${psico.status()}`).toBeTruthy();
  return { cedula, expedienteId: cuerpo.expediente.id, numero: cuerpo.expediente.numero };
}

async function captura(page: Page, nombre: string) {
  if (CAPTURAS) await page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: false });
}

for (const { nombre, viewport, conPdf } of VISTAS) {
  test(`captación sin Presupuesto ni Dirección General: reservar, Punto de Cuenta y aprobación (${nombre})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const contexto = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);
    const tag = viewport.width >= 768 ? "esc" : "mov";
    let admin: Record<string, string> = {};
    const previos: Record<string, string> = {};

    try {
      await iniciarSesionE2E(page);
      const token = (await contexto.cookies()).find((c) => c.name === "dj_access")?.value;
      expect(token, "el admin E2E debe tener sesión").toBeTruthy();
      admin = { Authorization: `Bearer ${token}` };
      for (const clave of CLAVES) previos[clave] = await valorFlag(page.request, admin, clave);
      for (const clave of CLAVES) await ponerFlag(page.request, admin, clave, "false");

      const { cedula, expedienteId, numero } = await prepararEnCaptacion(page.request, admin);

      // Sin puestos vacantes libres no se puede reservar: se avisa y se omite (no es un fallo de la pantalla).
      const libres = await page.request.get(`${API}/expedientes/${expedienteId}/vacantes/?page_size=1`, { headers: admin });
      expect(libres.ok(), `vacantes del expediente: HTTP ${libres.status()}`).toBeTruthy();
      const hayVacantes = ((await libres.json()) as Sobre<{ total: number }>).data.total > 0;
      if (!hayVacantes) test.info().annotations.push({ type: "sin-vacantes-libres", description: `expediente ${numero} (${expedienteId}) quedó en ENVIADO_CAPTACION sin usar` });
      test.skip(!hayVacantes, "No hay puestos vacantes libres (todos reservados): libere reservas de pruebas anteriores.");

      // 1. Detalle: paso a paso y acciones solo desde acciones[].
      await page.goto(`/captacion/expedientes/${expedienteId}`);
      await esperarHidratacion(page);
      await expect(page.getByText(`C.I. ${cedula}`)).toBeVisible();
      await expect(page.getByTestId("paso-reserva")).toHaveAttribute("data-estado", "pendiente");
      await expect(page.getByTestId("paso-punto_cuenta")).toHaveAttribute("data-estado", "bloqueado");
      await expect(page.getByTestId("paso-aprobacion")).toHaveAttribute("data-estado", "bloqueado");
      const generar = page.getByRole("button", { name: /generar el punto de cuenta/i });
      await expect(generar).toBeDisabled();
      // La causa del bloqueo se ve UNA vez (aviso ámbar); bajo el botón queda solo para lectores de pantalla.
      const causa = page.getByText(/reserve primero el puesto vacante/i);
      await expect(page.getByTestId("aviso-bloqueo").getByText(/reserve primero el puesto vacante/i)).toBeVisible();
      const visibles = await causa.evaluateAll((els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).length);
      expect(visibles, "la causa del bloqueo no debe verse dos veces").toBe(1);
      await captura(page, `m5-${tag}-1-inicio`);

      // 2. Reservar el puesto.
      await page.getByRole("button", { name: /^reservar puesto/i }).click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo.locator('[data-testid="fila-vacante"]:visible').first()).toBeVisible({ timeout: 30_000 });
      await captura(page, `m5-${tag}-2-vacantes`);
      await dialogo.getByRole("button", { name: /^reservar el puesto/i }).first().click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("paso-reserva")).toHaveAttribute("data-estado", "hecho");
      await expect(page.getByTestId("puesto-codigo")).toBeVisible();
      await expect(page.getByTestId("reserva-vence")).toContainText(/vence el/i);
      const puesto = (await page.getByTestId("puesto-codigo").textContent())?.trim() ?? "";
      await captura(page, `m5-${tag}-3-reservado`);

      // 3. Generar el Punto de Cuenta y descargar el PDF.
      await expect(page.getByTestId("paso-punto_cuenta")).toHaveAttribute("data-estado", "pendiente");
      await expect(generar).toBeEnabled();
      await generar.click();
      await page.getByRole("alertdialog").getByRole("button", { name: /^generar punto de cuenta$/i }).click();
      await expect(page.getByTestId("punto-cuenta-numero")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("paso-punto_cuenta")).toHaveAttribute("data-estado", "hecho");
      await expect(page.getByTestId("paso-aprobacion")).toHaveAttribute("data-estado", "pendiente");
      const [descarga] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /^descargar pdf$/i }).click(),
      ]);
      expect(descarga.suggestedFilename()).toMatch(/^punto-cuenta-.*\.pdf$/);
      const flujoPdf = await descarga.createReadStream();
      const cabecera: Buffer[] = [];
      for await (const trozo of flujoPdf) { cabecera.push(trozo as Buffer); if (Buffer.concat(cabecera).length >= 5) break; }
      expect(Buffer.concat(cabecera).subarray(0, 5).toString()).toBe("%PDF-");
      await captura(page, `m5-${tag}-4-punto-cuenta`);

      // 4. Registrar la aprobación: fecha obligatoria y no futura; PDF solo en móvil.
      await page.getByRole("button", { name: /registrar la aprobación firmada/i }).click();
      const aprobacion = page.getByRole("dialog");
      await aprobacion.getByRole("button", { name: /^registrar aprobación$/i }).click();
      await expect(aprobacion.getByText(/indique la fecha en que se firmó/i)).toBeVisible();
      const manana = new Date(Date.now() + 36 * 3600 * 1000);
      const futura = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(manana);
      await aprobacion.getByLabel(/fecha de la firma/i).fill(futura);
      await aprobacion.getByRole("button", { name: /^registrar aprobación$/i }).click();
      await expect(aprobacion.getByText(/no puede ser futura/i)).toBeVisible();
      await aprobacion.getByLabel(/fecha de la firma/i).fill(hoyEnCaracas());
      if (conPdf) {
        await aprobacion.getByLabel(/escaneado en pdf/i).setInputFiles({ name: "firmado.txt", mimeType: "text/plain", buffer: Buffer.from("no es pdf") });
        await expect(aprobacion.getByText(/debe ser un archivo pdf/i)).toBeVisible();
        await aprobacion.getByLabel(/escaneado en pdf/i).setInputFiles({ name: "firmado.pdf", mimeType: "application/pdf", buffer: PDF_MINIMO });
        await expect(aprobacion.getByText(/debe ser un archivo pdf/i)).toHaveCount(0);
      }
      await captura(page, `m5-${tag}-5-aprobacion`);
      await aprobacion.getByRole("button", { name: /^registrar aprobación$/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // 5. Estado Aprobado, firma registrada y PDF firmado (o adjuntarlo).
      await expect(page.getByTestId("aprobacion-fuera-sistema")).toContainText(/aprobado fuera del sistema · firma del \d{2}\/\d{2}\/\d{4}/i);
      await expect(page.getByTestId("paso-aprobacion")).toHaveAttribute("data-estado", "hecho");
      await expect(page.getByText("Aprobado", { exact: true }).first()).toBeVisible();
      if (conPdf) {
        const [firmado] = await Promise.all([
          page.waitForEvent("download"),
          page.getByRole("button", { name: /descargar el pdf firmado/i }).click(),
        ]);
        expect(firmado.suggestedFilename()).toMatch(/^punto-cuenta-firmado-.*\.pdf$/);
      } else {
        await expect(page.getByTestId("sin-pdf-firmado")).toBeVisible();
        await page.getByRole("button", { name: /adjuntar el punto de cuenta firmado/i }).click();
        await page.getByRole("dialog").getByLabel(/archivo pdf/i).setInputFiles({ name: "firmado.pdf", mimeType: "application/pdf", buffer: PDF_MINIMO });
        await page.getByRole("dialog").getByRole("button", { name: /^adjuntar pdf firmado$/i }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("button", { name: /descargar el pdf firmado/i })).toBeVisible();
      }
      await captura(page, `m5-${tag}-6-aprobado`);
      if (viewport.width < 768) await sinDesbordeHorizontal(page);

      // 6. Historial legible.
      await page.getByRole("tab", { name: /historial/i }).click();
      await expect(page.getByText(/^Aprobado fuera del sistema( \(Paso actual\))?$/)).toBeVisible();
      await expect(page.getByText(/registrado por .*· firma del \d{2}\/\d{2}\/\d{4}/i)).toBeVisible();
      await captura(page, `m5-${tag}-7-historial`);

      test.info().annotations.push({ type: "reserva-pendiente-de-liberar", description: `expediente ${numero} (${expedienteId}), cédula ${cedula}, puesto ${puesto}` });
    } finally {
      // Siempre se restauran los parámetros del proceso de ingreso (la base de desarrollo es compartida).
      for (const clave of CLAVES) await ponerFlag(page.request, admin, clave, previos[clave] === "false" ? "false" : "true").catch(() => undefined);
      await contexto.close();
    }
  });
}
