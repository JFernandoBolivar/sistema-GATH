import fs from "node:fs";
import path from "node:path";

import type { APIRequestContext, APIResponse, Page, TestInfo } from "@playwright/test";

import { iniciarSesionComo } from "../inicio-sesion";

/** Carpeta de capturas y bitácora de incidencias de la auditoría O46. */
export const DIR_O46 = path.resolve(__dirname, "../auditoria/o46");
const BITACORA = path.join(DIR_O46, "incidencias.jsonl");
const BACKEND = process.env.E2E_BACKEND_URL || "http://localhost:8001";

fs.mkdirSync(DIR_O46, { recursive: true });

export interface Vigilante {
  consola: string[];
  pageErrors: string[];
  respuestas5xx: string[];
}

/** Escucha errores de consola, excepciones no capturadas y respuestas 5xx de la página. */
export function vigilar(page: Page): Vigilante {
  const vigilante: Vigilante = { consola: [], pageErrors: [], respuestas5xx: [] };
  page.on("console", (mensaje) => {
    if (mensaje.type() === "error") vigilante.consola.push(mensaje.text());
  });
  page.on("pageerror", (error) => vigilante.pageErrors.push(error.message));
  page.on("response", (respuesta) => {
    if (respuesta.status() >= 500) {
      vigilante.respuestas5xx.push(
        `${respuesta.status()} ${respuesta.request().method()} ${respuesta.url()}`,
      );
    }
  });
  return vigilante;
}

export interface Desborde {
  documento: boolean;
  ancho: number;
  scrollWidth: number;
  elementos: string[];
}

/** Comprueba el desborde horizontal del documento y de elementos visibles fuera del viewport. */
export async function detectarDesborde(page: Page): Promise<Desborde> {
  return page.evaluate(() => {
    const ancho = window.innerWidth;
    const doc = document.documentElement;
    const elementos: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const estilo = getComputedStyle(el);
      if (
        estilo.display === "none" ||
        estilo.visibility === "hidden" ||
        Number(estilo.opacity) === 0
      ) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      // Los elementos dentro de un contenedor con scroll propio pueden salir del
      // viewport sin desbordar la página; no cuentan como desborde global.
      let padre = el.parentElement;
      let enContenedor = false;
      while (padre && padre !== document.body) {
        const estiloPadre = getComputedStyle(padre);
        if (/(auto|scroll|hidden)/.test(estiloPadre.overflowX)) {
          enContenedor = true;
          break;
        }
        padre = padre.parentElement;
      }
      if (enContenedor) continue;
      if (rect.left < -1 || rect.right > ancho + 1) {
        const rol = el.getAttribute("role");
        const descripcion = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
          rol ? `[role=${rol}]` : ""
        }`;
        elementos.push(
          `${descripcion} rect=${Math.round(rect.left)}..${Math.round(rect.right)}`,
        );
        if (elementos.length >= 8) break;
      }
    }
    return { documento: doc.scrollWidth > ancho + 1, ancho, scrollWidth: doc.scrollWidth, elementos };
  });
}

function limpiar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
}

export interface ResultadoPaso {
  problemas: string[];
  archivo: string;
  desborde: Desborde;
}

/**
 * Registra un paso del flujo: captura de pantalla, errores acumulados desde el
 * paso anterior y comprobación de desborde. No lanza: devuelve los problemas
 * para que el spec los anote y el informe los recoja.
 */
export async function paso(
  page: Page,
  info: TestInfo,
  vigilante: Vigilante,
  flujo: string,
  nombre: string,
  opciones: { espera?: number; fullPage?: boolean } = {},
): Promise<ResultadoPaso> {
  await page.waitForTimeout(opciones.espera ?? 500);
  const proyecto = info.project.name;
  const archivo = `${proyecto}-${flujo}-${limpiar(nombre)}.png`;
  const desborde = await detectarDesborde(page);
  await page.screenshot({
    path: path.join(DIR_O46, archivo),
    fullPage: opciones.fullPage ?? false,
  });

  const problemas: string[] = [];
  const consola = vigilante.consola.splice(0);
  const pageErrors = vigilante.pageErrors.splice(0);
  const respuestas5xx = vigilante.respuestas5xx.splice(0);
  if (consola.length) problemas.push(`consola: ${consola.join(" | ")}`);
  if (pageErrors.length) problemas.push(`pageerror: ${pageErrors.join(" | ")}`);
  if (respuestas5xx.length) problemas.push(`5xx: ${respuestas5xx.join(" | ")}`);
  if (desborde.documento) {
    problemas.push(
      `desborde horizontal: scrollWidth=${desborde.scrollWidth} > innerWidth=${desborde.ancho}`,
    );
  }
  if (desborde.elementos.length) {
    problemas.push(`elementos fuera del viewport: ${desborde.elementos.join(", ")}`);
  }

  if (problemas.length) {
    fs.appendFileSync(
      BITACORA,
      `${JSON.stringify({ proyecto, flujo, paso: nombre, archivo, problemas })}\n`,
    );
    for (const problema of problemas) console.log(`[O46][${flujo}][${nombre}] ${problema}`);
  }
  info.attach(`${flujo} - ${nombre}`, {
    path: path.join(DIR_O46, archivo),
    contentType: "image/png",
  });
  return { problemas, archivo, desborde };
}

/** Inicia sesión con las credenciales indicadas (helper existente de la suite). */
export async function entrar(page: Page, email: string, password: string): Promise<void> {
  // Cambiar de usuario dentro del mismo spec exige descartar la sesión anterior:
  // /login redirige a la app si ya hay sesión y el formulario nunca aparecería.
  await page.context().clearCookies();
  await iniciarSesionComo(page, email, password);
}

async function cookieAcceso(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  const dj = cookies.find((c) => c.name === "dj_access");
  return dj?.value;
}

/** Llama a la API real de Django con la sesión del navegador. */
export async function api(
  page: Page,
  ruta: string,
  opciones: Parameters<APIRequestContext["fetch"]>[1] = {},
): Promise<APIResponse> {
  const token = await cookieAcceso(page);
  const headers: Record<string, string> = {};
  new Headers(opciones.headers as HeadersInit | undefined).forEach((valor, clave) => {
    headers[clave] = valor;
  });
  if (token) headers.cookie = `dj_access=${token}`;
  if (opciones.data && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }
  return page.context().request.fetch(`${BACKEND}/api/v1/${ruta.replace(/^\//, "")}`, {
    ...opciones,
    headers,
  });
}

export async function apiJson<T = unknown>(
  page: Page,
  ruta: string,
  opciones: Parameters<APIRequestContext["fetch"]>[1] = {},
): Promise<T> {
  const respuesta = await api(page, ruta, opciones);
  const texto = await respuesta.text();
  if (!respuesta.ok()) {
    throw new Error(`API ${ruta} -> ${respuesta.status()}: ${texto.slice(0, 300)}`);
  }
  return JSON.parse(texto).data as T;
}

export interface DatosCarnet {
  id: number;
  empleado_cedula: string;
  security_hash: string;
  activo: boolean;
}

/** Devuelve el carnet más reciente de una cédula. */
export async function carnetDe(page: Page, cedula: string): Promise<DatosCarnet | undefined> {
  const carnets = await apiJson<DatosCarnet[]>(
    page,
    `carnetizacion/?cedula=${encodeURIComponent(cedula)}`,
  );
  return carnets[0];
}

export interface ValidacionPdf {
  bytes: number;
  cabecera: string;
  paginas: number;
}

/** Valida la firma %PDF y cuenta las páginas del documento descargado. */
export function validarPdf(buffer: Buffer): ValidacionPdf {
  const cabecera = buffer.subarray(0, 5).toString("latin1");
  const contenido = buffer.toString("latin1");
  const paginas = (contenido.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return { bytes: buffer.length, cabecera, paginas };
}

/** Guarda una descarga en la carpeta de la auditoría y devuelve su contenido. */
export async function guardarDescarga(
  descarga: import("@playwright/test").Download,
  nombre: string,
): Promise<Buffer> {
  const destino = path.join(DIR_O46, nombre);
  await descarga.saveAs(destino);
  return fs.readFileSync(destino);
}

/**
 * Pulsa un botón que descarga un PDF. Si el navegador no entrega el blob como
 * descarga, recupera el mismo documento por la API autenticada.
 */
export async function descargarOApi(
  page: Page,
  boton: import("@playwright/test").Locator,
  ruta: string,
  nombreArchivo: string,
): Promise<Buffer> {
  const espera = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await boton.click();
  const descarga = await espera;
  if (descarga) return guardarDescarga(descarga, nombreArchivo);
  const respuesta = await api(page, ruta);
  if (!respuesta.ok()) {
    throw new Error(`Descarga no disponible: GET /api/v1/${ruta} -> ${respuesta.status()}`);
  }
  const buffer = await respuesta.body();
  fs.writeFileSync(path.join(DIR_O46, nombreArchivo), buffer);
  return buffer;
}

/** Abre una ruta esperando a que la red quede estable. */
export async function ir(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta);
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
}

export function ahoraLocal(fecha: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(
    fecha.getHours(),
  )}:${pad(fecha.getMinutes())}`;
}
