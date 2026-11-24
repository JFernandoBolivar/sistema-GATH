import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";

/**
 * Preparación por API compartida por las E2E de la Ventana 2 con documentos: lleva un expediente hasta APROBADO con su puesto
 * reservado (misma preparación que `ventana2-contratacion.spec.ts`), crea una plantilla de prueba publicada y activa, y deja al
 * postulante con la Ventana 2 completa salvo el paso «Documentos».
 */
export const DJANGO = process.env.E2E_DJANGO_URL ?? "http://127.0.0.1:8001";
export const API = `${DJANGO}/api/v1/postulacion`;
export const API_DOCUMENTOS = `${DJANGO}/api/v1/documentos`;
export const CLAVE_NUEVA = "Clave2026Segura";

export const PDF_MINIMO = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R/Size 4>>\n%%EOF\n",
);

export type Sobre<T> = { data: T };
type Vacante = Record<string, number>;

/** Cédula de prueba en un rango alto e improbable (3xxxxxxx). */
export function cedulaAleatoria(): string {
  return `3${String(Math.floor(Math.random() * 10_000_000)).padStart(7, "0")}`;
}

export const hoyEnCaracas = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas" }).format(new Date());

export async function esperarHidratacion(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

export async function sinDesbordeHorizontal(page: Page) {
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(desborda, "la página no debe tener scroll horizontal").toBeFalsy();
}

// ---------------------------------------------------------------------------------------------------------------
// Preparación por API
// ---------------------------------------------------------------------------------------------------------------
export interface Preparado {
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
export async function prepararAprobado(contexto: BrowserContext, request: APIRequestContext): Promise<Preparado> {
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


/** Cambia la clave del postulante y completa por API la Ventana 2 (texto y foto): solo queda el paso «Documentos». */
export async function postulanteCompletaTodoPorApi(request: APIRequestContext, cedula: string, claveTemporal: string, contenidoFoto: Buffer) {
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
  const catalogo = async (consulta = "") => {
    const r = await request.get(`${API}/ventana2/catalogos/${consulta}`, { headers: h });
    expect(r.ok(), `catálogos: HTTP ${r.status()}`).toBeTruthy();
    return ((await r.json()) as Sobre<Record<string, Op[]> & { tallas: Record<string, Op[]> }>).data;
  };
  const base = await catalogo();
  const estado = base.estados[0].id;
  const municipio = (await catalogo(`?estado_id=${estado}`)).municipios[0].id;
  const parroquia = (await catalogo(`?estado_id=${estado}&municipio_id=${municipio}`)).parroquias[0].id;
  const put = await request.put(`${API}/ventana2/`, {
    headers: h,
    data: {
      sin_familiares: true,
      familiares: [],
      vivienda: {
        condicion_vivienda_id: base.condiciones_vivienda[0].id,
        estado_id: estado,
        municipio_id: municipio,
        parroquia_id: parroquia,
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
  const foto = await request.post(`${API}/ventana2/foto/`, { headers: h, multipart: { foto: { name: "foto.png", mimeType: "image/png", buffer: contenidoFoto } } });
  expect(foto.ok(), `foto por API: HTTP ${foto.status()}`).toBeTruthy();
}

/** Plantilla de prueba (formato propio, un campo propio obligatorio, firma por clic) publicada y ACTIVA. */
export async function crearPlantillaDePrueba(request: APIRequestContext, admin: Record<string, string>, codigo: string): Promise<string> {
  const crear = await request.post(`${API_DOCUMENTOS}/plantillas/`, {
    headers: admin,
    data: { codigo, nombre: "Documento E2E", descripcion: "Plantilla de prueba de la E2E de documentos.", modo: "formulario", momento: "ventana2", firmante: "postulante", requiere_firma_clic: true },
  });
  expect(crear.ok(), `crear plantilla: HTTP ${crear.status()}`).toBeTruthy();
  const id = ((await crear.json()) as Sobre<{ id: string }>).data.id;
  const definicion = {
    pagina: { tamano: "carta", orientacion: "vertical" },
    encabezado: { tipo: "institucional", titulo: "Documento E2E", subtitulo: "" },
    bloques: [
      { id: "a", tipo: "seccion", titulo: "Datos del postulante" },
      { id: "b", tipo: "fila_campos", celdas: [{ etiqueta: "Apellidos y nombres", variable: "nombre_completo", ancho: 3 }, { etiqueta: "Cédula", variable: "cedula", ancho: 1 }] },
      { id: "c", tipo: "parrafo", texto: "Declaro aspirar a {propio.sueldo}. Expediente {numero_expediente}." },
      { id: "d", tipo: "firmas", firmantes: [{ etiqueta: "FIRMA DEL POSTULANTE" }] },
    ],
  };
  const campos = [
    { clave: "sueldo", etiqueta: "Sueldo al que aspira", tipo: "texto", obligatorio: true, ayuda: "Escríbelo en dólares." },
    { clave: "inicio", etiqueta: "Fecha de inicio", tipo: "fecha", obligatorio: false },
  ];
  const guardar = await request.put(`${API_DOCUMENTOS}/plantillas/${id}/`, { headers: admin, data: { definicion, campos_propios: campos } });
  expect(guardar.ok(), `guardar plantilla: HTTP ${guardar.status()}`).toBeTruthy();
  const publicar = await request.post(`${API_DOCUMENTOS}/plantillas/${id}/publicar/`, { headers: admin });
  expect(publicar.ok(), `publicar plantilla: HTTP ${publicar.status()}`).toBeTruthy();
  await activarPlantilla(request, admin, id, true);
  return id;
}

export async function activarPlantilla(request: APIRequestContext, admin: Record<string, string>, id: string, activa: boolean) {
  const r = await request.post(`${API_DOCUMENTOS}/plantillas/${id}/activar/`, { headers: admin, data: { activa } });
  expect(r.ok(), `activar=${activa}: HTTP ${r.status()}`).toBeTruthy();
}

/** Captación reabre la Ventana 2 por API y devuelve la contraseña temporal (una sola vez). */
export async function reabrirVentana2(request: APIRequestContext, admin: Record<string, string>, expedienteId: string): Promise<string> {
  const r = await request.post(`${API}/expedientes/${expedienteId}/transicion/`, { headers: admin, data: { destino: "CONSOLIDANDO", entrega: "persona" } });
  expect(r.ok(), `reabrir Ventana 2: HTTP ${r.status()}`).toBeTruthy();
  return ((await r.json()) as Sobre<{ credencial: { clave_temporal: string } }>).data.credencial.clave_temporal;
}
