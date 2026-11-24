import { expect, test, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

/**
 * Presupuesto (E-1 a E-5) y Dirección General (E-6), con el admin E2E (tiene todos los permisos
 * `postulacion.*`). Todo el flujo previo (alta, Ventana 1, psicofísico APTO y apertura hacia Presupuesto)
 * se prepara por API; la UI cubre: reservar el puesto, declarar la constancia, emitir el Punto de Cuenta
 * (y descargar su PDF) y la decisión de Dirección General. Se corre en escritorio y en teléfono (390x844).
 *
 * La vacante NO depende de corridas anteriores: se prueban hasta 5 propuestas distintas tomadas de
 * `/cargos/vacantes/` y se usa la primera cuyo `solicitudes/<id>/vacantes/` (que excluye las reservadas)
 * no venga vacía.
 *
 * Dos caminos de Dirección General, para no acumular reservas:
 * - escritorio: APRUEBA. La reserva queda ACTIVA por diseño hasta la asignación (bloque G); el test anota
 *   `reserva-pendiente-de-liberar` con el expediente y el puesto.
 * - móvil: RECHAZA con motivo (antes verifica que sin motivo no deja) y comprueba que la reserva se liberó.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 }, decision: "aprobar" },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 }, decision: "rechazar" },
] as const;

/** PDF mínimo válido (firma `%PDF-`) para la constancia. */
const PDF_MINIMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R/Size 4>>\n%%EOF\n",
);

function cedulaAleatoria(): string {
  return `17${String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0")}`;
}

function hoyEnCaracas(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());
}

async function esperarHidratacion(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

/** Fila (escritorio) o tarjeta (teléfono) de ESE texto: no depende de otros expedientes de la base. */
function filaDe(page: Page, texto: string, ancho: number) {
  return ancho >= 768
    ? page.getByRole("row").filter({ hasText: texto })
    : page.getByRole("link").filter({ hasText: texto });
}

interface Preparado {
  cedula: string;
  expedienteId: string;
  numero: string;
  token: string;
}

type Sobre<T> = { data: T };

async function postulanteEnviaVentana1(request: APIRequestContext, cedula: string, claveTemporal: string) {
  const claveNueva = "Clave2026Segura";
  const acceso = await request.post(`${DJANGO}/api/v1/postulacion/acceso/`, { data: { cedula, password: claveTemporal } });
  expect(acceso.ok(), `acceso del postulante: HTTP ${acceso.status()}`).toBeTruthy();
  const tokenInicial = ((await acceso.json()) as Sobre<{ token: string }>).data.token;

  const cambio = await request.post(`${DJANGO}/api/v1/postulacion/cambiar-clave/`, {
    headers: { Authorization: `Bearer ${tokenInicial}` },
    data: { clave_actual: claveTemporal, clave_nueva: claveNueva },
  });
  expect(cambio.ok(), `cambio de clave: HTTP ${cambio.status()}`).toBeTruthy();
  const cabeceras = { Authorization: `Bearer ${((await cambio.json()) as Sobre<{ token: string }>).data.token}` };

  const borrador = await request.put(`${DJANGO}/api/v1/postulacion/borrador/`, {
    headers: cabeceras,
    data: {
      nombres: "Prueba",
      apellidos: "Presupuesto Direccion",
      datos_ventana1: { fecha_nacimiento: "1994-03-15", sexo: "F", nacionalidad: "V" },
    },
  });
  expect(borrador.ok(), `borrador: HTTP ${borrador.status()}`).toBeTruthy();
  const envio = await request.post(`${DJANGO}/api/v1/postulacion/enviar/`, { headers: cabeceras });
  expect(envio.ok(), `envío: HTTP ${envio.status()}`).toBeTruthy();
}

const MAX_INTENTOS = 8;

type Vacante = Record<string, number>;

/** Alta, Ventana 1, psicofísico APTO y apertura hacia Presupuesto con la propuesta de una vacante. */
async function abrirHaciaPresupuesto(request: APIRequestContext, admin: Record<string, string>, vacante: Vacante) {
  const cedula = cedulaAleatoria();
  const alta = await request.post(`${DJANGO}/api/v1/postulacion/postulantes/`, {
    headers: admin,
    data: { cedula, nombres: "Prueba", apellidos: "Presupuesto Direccion", correo: `p${cedula}@ejemplo.invalid` },
  });
  expect(alta.ok(), `alta del postulante: HTTP ${alta.status()}`).toBeTruthy();
  const cuerpo = ((await alta.json()) as Sobre<{ expediente: { id: string; numero: string }; credencial: { clave_temporal: string } }>).data;
  await postulanteEnviaVentana1(request, cedula, cuerpo.credencial.clave_temporal);

  const psico = await request.post(`${DJANGO}/api/v1/postulacion/expedientes/${cuerpo.expediente.id}/psicofisico/`, {
    headers: admin,
    multipart: { resultado: "APTO", fecha_aplicacion: hoyEnCaracas() },
  });
  expect(psico.ok(), `psicofísico: HTTP ${psico.status()}`).toBeTruthy();

  const abrir = await request.post(`${DJANGO}/api/v1/postulacion/expedientes/${cuerpo.expediente.id}/transicion/`, {
    headers: admin,
    data: {
      destino: "EN_PRESUPUESTO",
      datos: {
        cargo_id: vacante.denominacion_id,
        cargo_especifico_id: vacante.especifica_id,
        tipo_nomina_id: vacante.tipo_nomina_id,
        dependencia_id: vacante.dependencia_id,
        direccion_general_id: vacante.direccion_general_id,
        direccion_linea_id: vacante.direccion_linea_id,
        coordinacion_id: vacante.coordinacion_id,
      },
    },
  });
  expect(abrir.ok(), `abrir hacia Presupuesto: HTTP ${abrir.status()}`).toBeTruthy();
  return { cedula, expedienteId: cuerpo.expediente.id, numero: cuerpo.expediente.numero };
}

/** Propuestas distintas (cargo + jerarquía de oficina) en el orden en que las devuelve `/cargos/vacantes/`. */
function propuestasDistintas(vacantes: Vacante[]): Vacante[] {
  const vistas = new Set<string>();
  const salida: Vacante[] = [];
  for (const v of vacantes) {
    const clave = [v.denominacion_id, v.especifica_id, v.tipo_nomina_id, v.dependencia_id, v.direccion_general_id, v.direccion_linea_id, v.coordinacion_id].join("|");
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    salida.push(v);
  }
  return salida;
}

/**
 * Prepara una solicitud EN_PRESUPUESTO que SÍ tenga una vacante libre: prueba candidatas en orden (hasta 5, un
 * postulante nuevo por candidata) y se queda con la primera cuyo `vacantes/` no venga vacío.
 */
async function prepararSolicitud(contexto: BrowserContext, request: APIRequestContext): Promise<Preparado> {
  const token = (await contexto.cookies()).find((c) => c.name === "dj_access")?.value;
  expect(token, "el admin E2E debe tener sesión").toBeTruthy();
  const admin = { Authorization: `Bearer ${token}` };

  // Varias páginas: las corridas de escritorio aprueban y dejan su reserva ACTIVA (por diseño, hasta la asignación
  // del bloque G), así que las primeras propuestas pueden estar tomadas.
  const todas: Vacante[] = [];
  for (let pagina = 1; pagina <= 4; pagina++) {
    const lista = await request.get(`${DJANGO}/api/v1/cargos/vacantes/?pagina=${pagina}&page_size=50`, { headers: admin });
    if (!lista.ok()) break;
    const filas = ((await lista.json()) as Sobre<{ resultados: Vacante[] }>).data.resultados ?? [];
    todas.push(...filas);
    if (filas.length < 50) break;
  }
  const candidatas = propuestasDistintas(todas).slice(0, MAX_INTENTOS);
  expect(candidatas.length, "la base de pruebas necesita al menos un puesto vacante").toBeGreaterThan(0);

  for (const vacante of candidatas) {
    const e = await abrirHaciaPresupuesto(request, admin, vacante);
    const libres = await request.get(`${DJANGO}/api/v1/postulacion/solicitudes/${e.expedienteId}/vacantes/`, { headers: admin });
    expect(libres.ok(), `vacantes de la solicitud: HTTP ${libres.status()}`).toBeTruthy();
    const total = ((await libres.json()) as Sobre<{ total: number }>).data.total;
    if (total > 0) return { ...e, token: token as string };
  }
  throw new Error(`Ninguna de las ${candidatas.length} propuestas probadas tiene una vacante libre: libere reservas de pruebas anteriores.`);
}

interface ReservaApi {
  estado: string;
  puesto_id: number;
}

async function reservaDe(request: APIRequestContext, p: Preparado): Promise<ReservaApi | null> {
  const r = await request.get(`${DJANGO}/api/v1/postulacion/solicitudes/${p.expedienteId}/`, { headers: { Authorization: `Bearer ${p.token}` } });
  expect(r.ok(), `detalle de la solicitud: HTTP ${r.status()}`).toBeTruthy();
  return ((await r.json()) as Sobre<{ reserva: ReservaApi | null }>).data.reserva;
}

for (const { nombre, viewport, decision } of VISTAS) {
  test(`presupuesto y dirección general: reservar, constancia, Punto de Cuenta y ${decision === "aprobar" ? "aprobación" : "rechazo"} (${nombre})`, async ({ browser }) => {
    test.setTimeout(240_000);
    const contexto = await browser.newContext({ viewport, acceptDownloads: true });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);
    let preparado: Preparado | null = null;
    let decidido = false;

    try {
      await iniciarSesionE2E(page);
      preparado = await prepararSolicitud(contexto, page.request);
      const { cedula, numero } = preparado;

      // 1. Bandeja de Presupuesto: pestañas y búsqueda POR NÚMERO.
      await page.goto("/presupuesto");
      await page.waitForURL(/\/presupuesto\/solicitudes/);
      await esperarHidratacion(page);
      await expect(page.getByRole("heading", { name: /solicitudes de presupuesto/i })).toBeVisible();
      for (const pestana of [/por atender/i, /diferidos/i, /en corrección de cargo/i, /todos/i]) {
        await expect(page.getByRole("tab", { name: pestana })).toBeVisible();
      }
      await page.getByLabel(/buscar por cédula/i).fill(numero);
      const fila = filaDe(page, numero, viewport.width);
      await expect(fila).toHaveCount(1, { timeout: 30_000 });
      await (viewport.width >= 768 ? fila.getByRole("link") : fila).click();

      // 2. Detalle: guía de pasos y «Emitir» bloqueado.
      await page.waitForURL(/\/presupuesto\/solicitudes\/[0-9a-f-]{36}/);
      await esperarHidratacion(page);
      await expect(page.getByText(`C.I. ${cedula}`)).toBeVisible();
      await expect(page.getByTestId("paso-reserva")).toHaveAttribute("data-estado", "pendiente");
      await expect(page.getByTestId("paso-constancia")).toHaveAttribute("data-estado", "pendiente");
      await expect(page.getByTestId("paso-punto_cuenta")).toHaveAttribute("data-estado", "bloqueado");
      const emitir = page.getByRole("button", { name: /emitir el punto de cuenta/i });
      await expect(emitir).toBeDisabled();

      // 3. Elegir y reservar el puesto.
      await page.getByRole("button", { name: /elegir puesto/i }).click();
      const dialogo = page.getByRole("dialog");
      await expect(dialogo.locator('[data-testid="fila-vacante"]:visible').first()).toBeVisible({ timeout: 30_000 });
      await dialogo.getByRole("button", { name: /^reservar el puesto/i }).first().click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByTestId("paso-reserva")).toHaveAttribute("data-estado", "hecho");
      await expect(page.getByTestId("puesto-codigo")).toBeVisible();
      await expect(page.getByTestId("reserva-vence")).toBeVisible();
      await expect(emitir).toBeDisabled();

      // 4. Declarar la constancia (con PDF).
      await page.getByRole("button", { name: /^declarar disponibilidad$/i }).click();
      await expect(page.getByText(/indique la referencia/i)).toBeVisible();
      await page.getByLabel(/referencia \(partida u oficio\)/i).fill("OF-E2E-2026-001");
      await page.getByLabel(/observaciones \(opcional\)/i).fill("Constancia de prueba E2E.");
      await page.getByLabel(/constancia en pdf/i).setInputFiles({ name: "constancia.pdf", mimeType: "application/pdf", buffer: PDF_MINIMO });
      await page.getByRole("button", { name: /^declarar disponibilidad$/i }).click();
      await expect(page.getByTestId("constancia-referencia")).toHaveText("OF-E2E-2026-001");
      await expect(page.getByTestId("paso-constancia")).toHaveAttribute("data-estado", "hecho");
      await expect(page.getByTestId("paso-punto_cuenta")).toHaveAttribute("data-estado", "pendiente");

      // 5. Emitir el Punto de Cuenta y descargar el PDF.
      await expect(emitir).toBeEnabled();
      await emitir.click();
      await page.getByRole("alertdialog").getByRole("button", { name: /confirmar/i }).click();
      await expect(page.getByText("En Dirección General").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("punto-cuenta-numero")).toBeVisible();
      const [descarga] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", { name: /^descargar pdf$/i }).click(),
      ]);
      expect(descarga.suggestedFilename()).toMatch(/^punto-cuenta-.*\.pdf$/);

      // 6. Dirección General: no se rechaza sin motivo; se aprueba.
      await page.goto("/direccion");
      await page.waitForURL(/\/direccion\/ingresos/);
      await esperarHidratacion(page);
      await expect(page.getByRole("heading", { name: /ingresos por decidir/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /pendientes/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /hist[oó]rico/i })).toBeVisible();
      await page.getByLabel(/buscar por cédula/i).fill(cedula);
      const ingreso = filaDe(page, cedula, viewport.width);
      await expect(ingreso).toHaveCount(1, { timeout: 30_000 });
      await (viewport.width >= 768 ? ingreso.getByRole("link") : ingreso).click();
      await page.waitForURL(/\/direccion\/ingresos\/[0-9a-f-]{36}/);
      await esperarHidratacion(page);
      await expect(page.getByTestId("punto-cuenta-numero")).toBeVisible();
      await expect(page.getByRole("button", { name: /abrir pdf/i })).toBeVisible();

      await page.getByRole("button", { name: /rechazar el ingreso/i }).click();
      const dlgRechazo = page.getByRole("dialog");
      await dlgRechazo.getByRole("button", { name: /rechazar el ingreso/i }).click();
      await expect(dlgRechazo.getByText(/el motivo es obligatorio/i)).toBeVisible();
      await dlgRechazo.getByRole("button", { name: /cancelar/i }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      if (decision === "aprobar") {
        await page.getByRole("button", { name: /aprobar el ingreso/i }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: /confirmar/i }).click();
        await expect(page.getByText("Aprobado", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/aprobado y firmado/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /aprobar el ingreso/i })).toHaveCount(0);
        decidido = true;
        // Por diseño la reserva sigue ACTIVA hasta la asignación (bloque G): se anota para liberarla a mano.
        const reserva = await reservaDe(page.request, preparado);
        expect(reserva?.estado).toBe("ACTIVA");
        test.info().annotations.push({
          type: "reserva-pendiente-de-liberar",
          description: `Expediente ${preparado.numero} (${preparado.expedienteId}), puesto ${reserva?.puesto_id}: reserva ACTIVA tras aprobar.`,
        });
      } else {
        const reservaAntes = await reservaDe(page.request, preparado);
        expect(reservaAntes?.estado, "antes de rechazar la reserva está ACTIVA").toBe("ACTIVA");
        await page.getByRole("button", { name: /rechazar el ingreso/i }).click();
        const dlg = page.getByRole("dialog");
        await dlg.getByLabel(/motivo/i).fill("Rechazo de prueba E2E: el puesto no corresponde.");
        await dlg.getByRole("button", { name: /rechazar el ingreso/i }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText("Rechazado por Dirección").first()).toBeVisible({ timeout: 30_000 });
        await expect(page.getByRole("button", { name: /aprobar el ingreso/i })).toHaveCount(0);
        decidido = true;
        // La reserva quedó liberada: ya no hay una ACTIVA y el puesto vuelve a estar disponible.
        const reserva = await reservaDe(page.request, preparado);
        expect(reserva === null || reserva.estado !== "ACTIVA", "la reserva ya no está activa").toBeTruthy();
        await page.getByRole("tab", { name: /resumen/i }).click();
        await expect(page.getByText(/no hay un puesto reservado/i)).toBeVisible();
      }
    } finally {
      // Limpieza: si el test falló antes de decidir, se libera la reserva (tras decidir ya no corresponde).
      if (preparado && !decidido) {
        try {
          const r = await page.request.delete(`${DJANGO}/api/v1/postulacion/solicitudes/${preparado.expedienteId}/reserva/`, {
            headers: { Authorization: `Bearer ${preparado.token}` },
            data: {},
          });
          if (!r.ok() && r.status() !== 404) {
            test.info().annotations.push({
              type: "reserva-pendiente-de-liberar",
              description: `Expediente ${preparado.numero} (${preparado.expedienteId}): la reserva sigue ACTIVA (HTTP ${r.status()}); liberarla a mano.`,
            });
          }
        } catch {
          test.info().annotations.push({
            type: "reserva-pendiente-de-liberar",
            description: `Expediente ${preparado.numero} (${preparado.expedienteId}): no se pudo liberar la reserva.`,
          });
        }
      }
      await contexto.close();
    }
  });
}
