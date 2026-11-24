import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { iniciarSesionE2E } from "./credenciales";

/**
 * Ventana 2 del postulante y contratación (bloque G), con el admin E2E (tiene todos los permisos `postulacion.*`).
 *
 * Todo el flujo previo (alta, Ventana 1, psicofísico, Presupuesto con vacante libre, reserva, constancia, Punto de
 * Cuenta y aprobación de Dirección General) se prepara por API. La UI cubre:
 *  1. Captación reabre la Ventana 2 y ve la credencial UNA vez; el expediente aparece en «Por contactar» y marca «Ya lo contacté».
 *  2. El postulante entra con la credencial y completa la Ventana 2 (escritorio: todo por la UI salvo el cambio de
 *     clave por UI; móvil 390x844: las secciones de texto por API y la UI de la foto y del envío).
 *  3. Captación ve los datos y la foto y da «Conforme».
 *  4. Captación contrata y ve el panel de éxito.
 *
 * IMPORTANTE: la contratación crea un Employee REAL en la base de desarrollo (cédula 3xxxxxxx aleatoria) y consume
 * el puesto. La E2E NO lo borra: al final anota `limpiar-auditor` con la cédula, el expediente y el puesto.
 */
const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";
const API = `${DJANGO}/api/v1/postulacion`;
const CLAVE_NUEVA = "Clave2026Segura";
const FOTO = join(__dirname, "fixtures", "foto-ventana2-400.png");

const VISTAS = [
  { nombre: "escritorio", viewport: { width: 1280, height: 800 }, completoPorUI: true },
  { nombre: "móvil 390x844", viewport: { width: 390, height: 844 }, completoPorUI: false },
] as const;

const PDF_MINIMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R/Size 4>>\n%%EOF\n",
);

type Sobre<T> = { data: T };
type Vacante = Record<string, number>;

/** Cédula de prueba en un rango alto e improbable (3xxxxxxx). */
function cedulaAleatoria(): string {
  return `3${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;
}

const hoyEnCaracas = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());

async function esperarHidratacion(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

function filaDe(page: Page, texto: string, ancho: number) {
  return ancho >= 768 ? page.getByRole("row").filter({ hasText: texto }) : page.getByRole("link").filter({ hasText: texto });
}

async function sinDesbordeHorizontal(page: Page) {
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(desborda, "la página no debe tener scroll horizontal").toBeFalsy();
}

// ---------------------------------------------------------------------------------------------------------------
// Preparación por API
// ---------------------------------------------------------------------------------------------------------------
interface Preparado {
  cedula: string;
  expedienteId: string;
  numero: string;
  puestoId: number;
  admin: Record<string, string>;
}

async function postulanteEnviaVentana1(request: APIRequestContext, cedula: string, claveTemporal: string) {
  const acceso = await request.post(`${API}/acceso/`, { data: { cedula, password: claveTemporal } });
  expect(acceso.ok(), `acceso del postulante: HTTP ${acceso.status()}`).toBeTruthy();
  const tokenInicial = ((await acceso.json()) as Sobre<{ token: string }>).data.token;
  const cambio = await request.post(`${API}/cambiar-clave/`, {
    headers: { Authorization: `Bearer ${tokenInicial}` },
    data: { clave_actual: claveTemporal, clave_nueva: CLAVE_NUEVA },
  });
  expect(cambio.ok(), `cambio de clave: HTTP ${cambio.status()}`).toBeTruthy();
  const cabeceras = { Authorization: `Bearer ${((await cambio.json()) as Sobre<{ token: string }>).data.token}` };
  const borrador = await request.put(`${API}/borrador/`, {
    headers: cabeceras,
    data: { nombres: "Prueba", apellidos: "Ventana Dos", datos_ventana1: { fecha_nacimiento: "1990-06-15", sexo: "F", nacionalidad: "V" } },
  });
  expect(borrador.ok(), `borrador: HTTP ${borrador.status()}`).toBeTruthy();
  const envio = await request.post(`${API}/enviar/`, { headers: cabeceras });
  expect(envio.ok(), `envío: HTTP ${envio.status()}`).toBeTruthy();
}

/** Alta -> V1 -> psicofísico -> Presupuesto con la propuesta de una vacante. */
async function abrirHaciaPresupuesto(request: APIRequestContext, admin: Record<string, string>, vacante: Vacante) {
  const cedula = cedulaAleatoria();
  const alta = await request.post(`${API}/postulantes/`, {
    headers: admin,
    data: { cedula, nombres: "Prueba", apellidos: "Ventana Dos", correo: `v2${cedula}@ejemplo.invalid` },
  });
  expect(alta.ok(), `alta del postulante: HTTP ${alta.status()}`).toBeTruthy();
  const cuerpo = ((await alta.json()) as Sobre<{ expediente: { id: string; numero: string }; credencial: { clave_temporal: string } }>).data;
  await postulanteEnviaVentana1(request, cedula, cuerpo.credencial.clave_temporal);
  const psico = await request.post(`${API}/expedientes/${cuerpo.expediente.id}/psicofisico/`, {
    headers: admin,
    multipart: { resultado: "APTO", fecha_aplicacion: hoyEnCaracas() },
  });
  expect(psico.ok(), `psicofísico: HTTP ${psico.status()}`).toBeTruthy();
  const abrir = await request.post(`${API}/expedientes/${cuerpo.expediente.id}/transicion/`, {
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

/** Deja un expediente APROBADO con su puesto reservado (reserva ACTIVA, constancia y Punto de Cuenta emitidos). */
async function prepararAprobado(contexto: BrowserContext, request: APIRequestContext): Promise<Preparado> {
  const token = (await contexto.cookies()).find((c) => c.name === "dj_access")?.value;
  expect(token, "el admin E2E debe tener sesión").toBeTruthy();
  const admin = { Authorization: `Bearer ${token}` };

  const todas: Vacante[] = [];
  for (let pagina = 1; pagina <= 4; pagina++) {
    const lista = await request.get(`${DJANGO}/api/v1/cargos/vacantes/?pagina=${pagina}&page_size=50`, { headers: admin });
    if (!lista.ok()) break;
    const filas = ((await lista.json()) as Sobre<{ resultados: Vacante[] }>).data.resultados ?? [];
    todas.push(...filas);
    if (filas.length < 50) break;
  }
  const candidatas = propuestasDistintas(todas).slice(0, 8);
  expect(candidatas.length, "la base de pruebas necesita al menos un puesto vacante").toBeGreaterThan(0);

  for (const vacante of candidatas) {
    const e = await abrirHaciaPresupuesto(request, admin, vacante);
    const libres = await request.get(`${API}/solicitudes/${e.expedienteId}/vacantes/`, { headers: admin });
    expect(libres.ok(), `vacantes de la solicitud: HTTP ${libres.status()}`).toBeTruthy();
    const datos = ((await libres.json()) as Sobre<{ total: number; resultados: { id: number }[] }>).data;
    if (datos.total === 0) continue;
    const puestoId = datos.resultados[0].id;

    const reserva = await request.post(`${API}/solicitudes/${e.expedienteId}/reserva/`, { headers: admin, data: { puesto_id: puestoId } });
    expect(reserva.ok(), `reserva: HTTP ${reserva.status()}`).toBeTruthy();
    const constancia = await request.post(`${API}/solicitudes/${e.expedienteId}/constancia/`, {
      headers: admin,
      multipart: { referencia: "OF-E2E-V2-001", observaciones: "Constancia de prueba E2E.", adjunto: { name: "constancia.pdf", mimeType: "application/pdf", buffer: PDF_MINIMO } },
    });
    expect(constancia.ok(), `constancia: HTTP ${constancia.status()}`).toBeTruthy();
    const emitir = await request.post(`${API}/solicitudes/${e.expedienteId}/transicion/`, { headers: admin, data: { destino: "EN_DIRECCION_GENERAL" } });
    expect(emitir.ok(), `emitir Punto de Cuenta: HTTP ${emitir.status()}`).toBeTruthy();
    const aprobar = await request.post(`${API}/ingresos/${e.expedienteId}/transicion/`, { headers: admin, data: { destino: "APROBADO" } });
    expect(aprobar.ok(), `aprobar en Dirección General: HTTP ${aprobar.status()}`).toBeTruthy();
    return { ...e, puestoId, admin };
  }
  throw new Error("Ninguna propuesta probada tiene una vacante libre: libere reservas de pruebas anteriores.");
}

/** Cambia la clave y completa por API todo lo de la Ventana 2 salvo la foto (para el recorrido móvil). */
async function postulanteCompletaTextoPorApi(request: APIRequestContext, cedula: string, claveTemporal: string) {
  const acceso = await request.post(`${API}/acceso/`, { data: { cedula, password: claveTemporal } });
  expect(acceso.ok(), `acceso V2: HTTP ${acceso.status()}`).toBeTruthy();
  const inicial = ((await acceso.json()) as Sobre<{ token: string }>).data.token;
  const cambio = await request.post(`${API}/cambiar-clave/`, {
    headers: { Authorization: `Bearer ${inicial}` },
    data: { clave_actual: claveTemporal, clave_nueva: CLAVE_NUEVA },
  });
  expect(cambio.ok(), `cambio de clave V2: HTTP ${cambio.status()}`).toBeTruthy();
  const h = { Authorization: `Bearer ${((await cambio.json()) as Sobre<{ token: string }>).data.token}` };

  type Op = { id: number };
  type Tallas = { id: number };
  const catalogo = async (consulta = "") => {
    const r = await request.get(`${API}/ventana2/catalogos/${consulta}`, { headers: h });
    expect(r.ok(), `catálogos: HTTP ${r.status()}`).toBeTruthy();
    return ((await r.json()) as Sobre<Record<string, Op[]> & { tallas: Record<string, Tallas[]> }>).data;
  };
  const base = await catalogo();
  const estado = base.estados[0].id;
  const conEstado = await catalogo(`?estado_id=${estado}`);
  const municipio = conEstado.municipios[0].id;
  const conMunicipio = await catalogo(`?estado_id=${estado}&municipio_id=${municipio}`);
  const put = await request.put(`${API}/ventana2/`, {
    headers: h,
    data: {
      sin_familiares: true,
      familiares: [],
      vivienda: {
        condicion_vivienda_id: base.condiciones_vivienda[0].id,
        estado_id: estado,
        municipio_id: municipio,
        parroquia_id: conMunicipio.parroquias[0].id,
        direccion_exacta: "Calle de prueba E2E, casa 1",
      },
      salud: { grupo_sanguineo_id: base.grupos_sanguineos[0].id, alergias: [], patologias_cronicas: [], discapacidades: [] },
      // F-8: al menos un estudio (el nivel académico más alto); cursos, experiencia e idiomas son opcionales.
      estudios: [{ nivel_academico_id: base.niveles_academicos[0].id }],
      tallas: {
        talla_camisa_id: base.tallas.camisa[0].id,
        talla_pantalon_id: base.tallas.pantalon[0].id,
        talla_zapatos_id: base.tallas.calzado[0].id,
      },
    },
  });
  expect(put.ok(), `PUT ventana2: HTTP ${put.status()}`).toBeTruthy();
}

// ---------------------------------------------------------------------------------------------------------------
// Pasos de la UI
// ---------------------------------------------------------------------------------------------------------------
async function elegirPrimera(page: Page, nombre: RegExp) {
  await page.getByRole("combobox", { name: nombre }).click();
  await page.getByRole("option").first().click();
}

async function capturaCredencial(page: Page): Promise<{ usuario: string; clave: string }> {
  const dialogo = page.getByRole("dialog");
  await expect(dialogo.getByTestId("credencial-clave")).toBeVisible({ timeout: 30_000 });
  const usuario = (await dialogo.getByTestId("credencial-usuario").textContent())?.trim() ?? "";
  const clave = (await dialogo.getByTestId("credencial-clave").textContent())?.trim() ?? "";
  expect(clave.length).toBeGreaterThan(6);
  await dialogo.getByRole("button", { name: /ya la entregué/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return { usuario, clave };
}

async function entrarComoPostulante(browser: Browser, viewport: { width: number; height: number }, cedula: string, clave: string, cambiaClavePorUI: boolean) {
  const contexto = await browser.newContext({ viewport });
  const page = await contexto.newPage();
  page.setDefaultTimeout(30_000);
  await page.goto("/postulacion/acceso");
  await esperarHidratacion(page);
  await page.getByLabel("Cédula de identidad").fill(cedula);
  await page.getByLabel("Contraseña", { exact: true }).fill(clave);
  await page.getByRole("button", { name: "Ingresar" }).click();
  if (cambiaClavePorUI) {
    await page.waitForURL(/\/postulacion\/cambiar-clave/);
    await esperarHidratacion(page);
    await page.getByLabel("Contraseña temporal", { exact: true }).fill(clave);
    await page.getByLabel("Contraseña nueva", { exact: true }).fill(CLAVE_NUEVA);
    await page.getByLabel("Repite la contraseña nueva", { exact: true }).fill(CLAVE_NUEVA);
    await page.getByRole("button", { name: /guardar y continuar/i }).click();
  }
  await page.waitForURL((u) => u.pathname === "/postulacion");
  await esperarHidratacion(page);
  return { contexto, page };
}

async function subirFotoPorUI(page: Page, movil: boolean) {
  // Validación en el cliente: un archivo que no es imagen se rechaza sin llamar al servidor.
  await page.getByTestId("foto-archivo").setInputFiles({ name: "nota.txt", mimeType: "text/plain", buffer: Buffer.from("no soy una foto") });
  await expect(page.getByRole("alert").filter({ hasText: /JPEG o PNG/i })).toBeVisible();
  // «Continuar» sigue bloqueado sin foto guardada.
  await expect(page.getByRole("button", { name: /^continuar$/i })).toBeDisabled();
  if (movil) {
    await expect(page.getByRole("button", { name: /tomar foto/i })).toBeVisible();
    await expect(page.getByTestId("foto-camara")).toHaveAttribute("capture", "user");
  } else {
    await expect(page.getByRole("button", { name: /tomar foto/i })).toBeHidden();
  }
  await page.getByTestId("foto-archivo").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: readFileSync(FOTO) });
  await expect(page.getByTestId("foto-vista")).toBeVisible();
  await page.getByRole("button", { name: /guardar esta foto/i }).click();
  await expect(page.getByText(/foto guardada/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /^continuar$/i })).toBeEnabled();
}

async function completarVentana2PorUI(page: Page) {
  // Familiares: una tarjeta vacía no deja continuar y lo explica; luego se declara «sin carga familiar».
  await expect(page.getByRole("heading", { name: /tu grupo familiar/i })).toBeVisible();
  await page.getByRole("button", { name: /agregar familiar/i }).click();
  await expect(page.getByTestId("tarjeta-familiar")).toHaveCount(1);
  await page.getByRole("button", { name: /guardar y continuar/i }).click();
  await expect(page.getByText(/completa los datos marcados/i)).toBeVisible();
  await expect(page.getByText(/escribe el primer nombre/i)).toBeVisible();
  await page.getByRole("button", { name: /quitar al familiar 1/i }).click();
  await page.getByLabel(/no tengo carga familiar/i).click();
  await page.getByRole("button", { name: /guardar y continuar/i }).click();

  // Vivienda.
  await expect(page.getByRole("heading", { name: /tu vivienda/i })).toBeVisible();
  await elegirPrimera(page, /tipo y tenencia/i);
  await elegirPrimera(page, /^estado$/i);
  await expect(page.getByRole("combobox", { name: /^municipio$/i })).toBeEnabled();
  await elegirPrimera(page, /^municipio$/i);
  await expect(page.getByRole("combobox", { name: /^parroquia$/i })).toBeEnabled();
  await elegirPrimera(page, /^parroquia$/i);
  await page.getByLabel(/dirección exacta/i).fill("Avenida principal, casa de prueba E2E");
  await page.getByRole("button", { name: /guardar y continuar/i }).click();

  // Salud.
  await expect(page.getByRole("heading", { name: /tu salud/i })).toBeVisible();
  await elegirPrimera(page, /grupo sanguíneo/i);
  // Los chips alternan `aria-pressed` (se prueba con la primera alergia disponible y se deja sin marcar).
  const alergia = page.getByRole("group", { name: /^alergias$/i }).getByRole("button").first();
  if (await alergia.isVisible().catch(() => false)) {
    await alergia.click();
    await expect(alergia).toHaveAttribute("aria-pressed", "true");
    await alergia.click();
    await expect(alergia).toHaveAttribute("aria-pressed", "false");
  }
  await page.getByRole("button", { name: /guardar y continuar/i }).click();

  // Tallas.
  await expect(page.getByRole("heading", { name: /tus tallas/i })).toBeVisible();
  await elegirPrimera(page, /^camisa$/i);
  await elegirPrimera(page, /^pantalón$/i);
  await elegirPrimera(page, /^calzado$/i);
  await page.getByRole("button", { name: /guardar y continuar/i }).click();

  // Estudios (F-8, obligatorio): sin ninguno no deja continuar; con el nivel más alto sí.
  await expect(page.getByRole("heading", { name: /tus estudios/i })).toBeVisible();
  await page.getByRole("button", { name: /agregar estudio/i }).click();
  await expect(page.getByTestId("tarjeta-estudio")).toHaveCount(1);
  await elegirPrimera(page, /nivel académico/i);
  await page.getByRole("button", { name: /guardar y continuar/i }).click();

  // Cursos, experiencia pública e idiomas/RIF son opcionales: se declara que no aplican.
  await expect(page.getByRole("heading", { name: /cursos y capacitaciones/i })).toBeVisible();
  await page.getByLabel(/no tengo cursos/i).click();
  await page.getByRole("button", { name: /guardar y continuar/i }).click();
  await expect(page.getByRole("heading", { name: /experiencia en la administración pública/i })).toBeVisible();
  await page.getByLabel(/no he trabajado en la administración pública/i).click();
  await page.getByRole("button", { name: /guardar y continuar/i }).click();
  await expect(page.getByRole("heading", { name: /^idiomas$/i })).toBeVisible();
  await page.getByLabel(/no domino otros idiomas/i).click();
  await page.getByRole("button", { name: /guardar y continuar/i }).click();
}

// ---------------------------------------------------------------------------------------------------------------
for (const { nombre, viewport, completoPorUI } of VISTAS) {
  test(`ventana 2 y contratación: reabrir, completar, conforme y contratar (${nombre})`, async ({ browser }) => {
    test.setTimeout(420_000);
    const contexto = await browser.newContext({ viewport });
    const page = await contexto.newPage();
    page.setDefaultTimeout(30_000);
    let preparado: Preparado | null = null;
    let contratado = false;
    let contextoPostulante: BrowserContext | null = null;

    try {
      await iniciarSesionE2E(page);
      preparado = await prepararAprobado(contexto, page.request);
      const { cedula, expedienteId } = preparado;

      // 1. Captación reabre la Ventana 2 desde la UI y ve la credencial UNA vez.
      await page.goto(`/captacion/expedientes/${expedienteId}`);
      await esperarHidratacion(page);
      await expect(page.getByText(`C.I. ${cedula}`)).toBeVisible();
      await page.getByRole("button", { name: /reabrir (la )?ventana 2/i }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /confirmar/i }).click();
      const credencial = await capturaCredencial(page);
      expect(credencial.usuario).toBe(cedula);
      await expect(page.getByText("Completando expediente").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("banner-contacto")).toBeVisible();

      // 1b. Aparece en «Por contactar» y se marca «Ya lo contacté».
      await page.goto("/captacion/expedientes");
      await esperarHidratacion(page);
      const pestana = page.getByRole("tab", { name: /por contactar/i });
      await expect(pestana).toBeVisible();
      await pestana.click();
      await page.getByLabel(/buscar por cédula/i).fill(cedula);
      const fila = filaDe(page, cedula, viewport.width);
      await expect(fila).toHaveCount(1, { timeout: 30_000 });
      await expect(fila.getByTestId("insignia-contacto")).toBeVisible();
      if (viewport.width < 768) await sinDesbordeHorizontal(page);
      await (viewport.width >= 768 ? fila.getByRole("link") : fila).click();
      await page.waitForURL(/\/captacion\/expedientes\/[0-9a-f-]{36}/);
      await esperarHidratacion(page);
      await page.getByRole("button", { name: /ya lo contacté/i }).click();
      await page.getByRole("dialog").getByLabel(/nota/i).fill("Llamada de prueba E2E.");
      await page.getByRole("dialog").getByRole("button", { name: /confirmar contacto/i }).click();
      await expect(page.getByTestId("banner-contacto")).toHaveCount(0, { timeout: 30_000 });

      // 2. El postulante entra con la credencial y completa la Ventana 2.
      if (!completoPorUI) await postulanteCompletaTextoPorApi(page.request, cedula, credencial.clave);
      // Si el texto se completó por API, la clave ya se cambió allí: se entra con la nueva.
      const claveDeEntrada = completoPorUI ? credencial.clave : CLAVE_NUEVA;
      const sesion = await entrarComoPostulante(browser, viewport, cedula, claveDeEntrada, completoPorUI);
      contextoPostulante = sesion.contexto;
      const post = sesion.page;
      await expect(post.getByRole("heading", { name: /tu ingreso fue aprobado/i })).toBeVisible();
      await expect(post.getByRole("navigation", { name: /avance de la ventana 2/i })).toBeVisible();
      if (viewport.width < 768) await sinDesbordeHorizontal(post);

      if (completoPorUI) {
        await completarVentana2PorUI(post);
      } else {
        // Lo de texto ya está: el formulario abre en la primera sección pendiente (la foto).
        await expect(post.getByRole("heading", { name: /tu foto de carnet/i })).toBeVisible();
      }

      // Foto (UI).
      await expect(post.getByRole("heading", { name: /tu foto de carnet/i })).toBeVisible();
      await subirFotoPorUI(post, viewport.width < 768);
      if (viewport.width < 768) await sinDesbordeHorizontal(post);
      await post.getByRole("button", { name: /^continuar$/i }).click();

      // Documentos (sin plantillas activas pendientes no hay nada que firmar): se continúa.
      await expect(post.getByRole("heading", { name: /^documentos$/i })).toBeVisible();
      await post.getByRole("button", { name: /^continuar$/i }).click();

      // Revisar y enviar.
      await expect(post.getByTestId("avance-texto")).toContainText("10 de 10");
      await expect(post.getByRole("button", { name: /enviar mis datos/i })).toBeEnabled();
      await post.getByRole("button", { name: /enviar mis datos/i }).click();
      await post.getByRole("alertdialog").getByRole("button", { name: /sí, enviar/i }).click();
      await post.waitForURL(/\/postulacion\/recibido\?.*v=2/);
      await expect(post.getByRole("heading", { name: /recibimos tus datos/i })).toBeVisible();
      await contextoPostulante.close();
      contextoPostulante = null;

      // 3. Captación ve los datos y la foto y da «Conforme».
      await page.goto(`/captacion/expedientes/${expedienteId}`);
      await esperarHidratacion(page);
      await expect(page.getByText("Revisión final").first()).toBeVisible();
      await page.getByRole("tab", { name: /datos de ventana 2/i }).click();
      await expect(page.getByText(/no tiene carga familiar/i)).toBeVisible();
      await expect(page.getByText(/la ventana 2 está completa/i)).toBeVisible();
      await page.getByRole("tab", { name: /^foto$/i }).click();
      const foto = page.getByTestId("foto-postulante");
      await expect(foto).toBeVisible();
      await expect.poll(async () => foto.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);

      await page.getByRole("button", { name: /conforme/i }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: /confirmar/i }).click();
      await expect(page.getByText("Listo para asignar").first()).toBeVisible({ timeout: 30_000 });

      // 4. Contratar: confirmación que resume lo que pasará y panel de éxito.
      const contratar = page.getByRole("button", { name: /contratar y asignar puesto/i });
      await expect(contratar).toBeEnabled();
      await contratar.click();
      const confirmacion = page.getByRole("alertdialog");
      await expect(confirmacion.getByText(/se asignará el puesto/i)).toBeVisible();
      await confirmacion.getByRole("button", { name: /^contratar$/i }).click();
      contratado = true;
      await expect(page.getByTestId("panel-contratacion")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId("contratacion-puesto")).toBeVisible();
      await expect(page.getByTestId("contratacion-cuenta")).toBeVisible();
      await expect(page.getByRole("link", { name: /ver la ficha del trabajador/i })).toHaveAttribute("href", new RegExp(`cedula=${cedula}`));
      await expect(page.getByText("Contratado").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /contratar y asignar puesto/i })).toHaveCount(0);
    } finally {
      if (preparado) {
        test.info().annotations.push({
          type: "limpiar-auditor",
          description:
            `Expediente ${preparado.numero} (${preparado.expedienteId}), cédula ${preparado.cedula}, puesto ${preparado.puestoId}. ` +
            (contratado
              ? "Se creó un Employee real (y su familia/vivienda/salud/tallas, el movimiento INGRESO y la reserva CONSUMIDA): limpiar a mano."
              : "No llegó a contratarse: la reserva del puesto sigue ACTIVA (liberarla) y el expediente quedó a medias."),
        });
      }
      await contextoPostulante?.close().catch(() => {});
      await contexto.close();
    }
  });
}
