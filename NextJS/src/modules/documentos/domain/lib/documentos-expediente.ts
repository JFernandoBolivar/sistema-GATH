/**
 * Documentos digitales del expediente (F-4, F-5, F-6): campos propios de cada plantilla, estado y evidencia de firma.
 * Espejo de `application/use_cases/documentos_sujeto.py` del backend. Lo usan el postulante (paso «Documentos» de la
 * Ventana 2) y Captación (pestaña «Documentos» del detalle).
 */

export type TipoCampoPropio = "texto" | "texto_largo" | "fecha" | "si_no" | "opcion";

export interface CampoPropioDTO {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoPropio;
  obligatorio: boolean;
  ayuda: string;
  opciones: string[];
}

export type EstadoDocumento = "pendiente_datos" | "listo_para_revisar" | "firmado" | "generado";

export interface FirmaDocumentoDTO {
  firmadoEn: string;
  /** IP con la parte final oculta (`190.12.•.•`): nunca la completa. */
  ipEnmascarada: string;
  sha256: string;
  textoConformidad: string;
  documentoId: string;
  version: number;
}

export interface DocumentoExpedienteDTO {
  plantillaId: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  proceso: string;
  procesoEtiqueta: string;
  version: number;
  firmante: string;
  requiereFirma: boolean;
  camposPropios: CampoPropioDTO[];
  /** `{clave: valor}` tal como los guardó el servidor (fechas como DD/MM/AAAA). */
  valores: Record<string, string>;
  /** Etiquetas de los campos obligatorios sin llenar. */
  faltan: string[];
  estado: EstadoDocumento;
  /** Estaba firmado y un cambio de datos deshizo la firma: hay que firmar otra vez. */
  firmaInvalidada: boolean;
  documentoId: string | null;
  firma: FirmaDocumentoDTO | null;
  textoConformidad: string;
  trabajadorCedula: string;
  /** Solo Captación: ruta del PDF (firmado, o la vista actual sin firmar). */
  archivoUrl: string | null;
}

export const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  pendiente_datos: "Faltan datos",
  listo_para_revisar: "Listo para revisar",
  firmado: "Firmado",
  generado: "Generado",
};

export const MAX_TEXTO_CAMPO_PROPIO = 4000;

const RE_DMA = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Valor del servidor al valor del control: `DD/MM/AAAA` pasa a `AAAA-MM-DD` (campo de fecha del navegador). */
export function valorAControl(campo: Pick<CampoPropioDTO, "tipo">, valor: string | undefined): string {
  const v = valor ?? "";
  if (campo.tipo !== "fecha") return v;
  const m = RE_DMA.exec(v);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : v;
}

/** Valores iniciales de todos los controles de un documento. */
export function valoresAControles(campos: readonly CampoPropioDTO[], valores: Record<string, string>): Record<string, string> {
  return Object.fromEntries(campos.map((c) => [c.clave, valorAControl(c, valores[c.clave])]));
}

/** Cuerpo del PUT: lo vacío no se envía (el servidor lo toma como «sin llenar»). */
export function cuerpoDeValores(campos: readonly CampoPropioDTO[], controles: Record<string, string>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const c of campos) {
    const v = (controles[c.clave] ?? "").trim();
    if (v) salida[c.clave] = v;
  }
  return salida;
}

/** Etiquetas de los obligatorios que siguen vacíos en los controles (para avisar antes de firmar). */
export function obligatoriosVacios(campos: readonly CampoPropioDTO[], controles: Record<string, string>): string[] {
  return campos.filter((c) => c.obligatorio && !(controles[c.clave] ?? "").trim()).map((c) => c.etiqueta);
}

/** Verdadero si lo escrito en pantalla difiere de lo guardado (hay cambios sin guardar). */
export function hayCambios(campos: readonly CampoPropioDTO[], controles: Record<string, string>, guardados: Record<string, string>): boolean {
  return campos.some((c) => (controles[c.clave] ?? "").trim() !== valorAControl(c, guardados[c.clave]).trim());
}

/** Huella corta para mostrar: `a1b2c3d4…f9e8d7c6`. */
export function huellaCorta(sha256: string): string {
  return sha256.length > 20 ? `${sha256.slice(0, 8)}…${sha256.slice(-8)}` : sha256;
}

/** Cuántos documentos de la lista siguen sin resolver para poder enviar (sin llenar o sin firmar cuando la requieren). */
export function pendientesDeDocumentos(docs: readonly DocumentoExpedienteDTO[]): number {
  return docs.filter((d) => d.faltan.length > 0 || (d.requiereFirma && d.estado !== "firmado")).length;
}
