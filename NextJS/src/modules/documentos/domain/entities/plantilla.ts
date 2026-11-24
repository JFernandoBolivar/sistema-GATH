/**
 * Tipos del diseñador de plantillas de documentos (módulo `documentos`).
 * Reflejan el contrato del backend: `/api/v1/documentos/`.
 */

export type ModoPlantilla = "formulario" | "pdf_overlay";
export type MomentoDocumento = "ventana2" | "contratacion" | "otro";
export type FirmanteDocumento = "postulante" | "conatel" | "ambos";
export type EstadoPlantilla = "borrador" | "publicada";

export interface PlantillaResumen {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  modo: ModoPlantilla;
  momento: MomentoDocumento;
  firmante: FirmanteDocumento;
  requiere_firma_clic: boolean;
  activa: boolean;
  estado: EstadoPlantilla;
  ultima_version: number | null;
  cambios_sin_publicar: boolean;
  tiene_fondo: boolean;
  actualizada_en: string | null;
}

export interface PaginaFondo {
  numero: number;
  ancho_pt: number;
  alto_pt: number;
  ancho_mm: number;
  alto_mm: number;
}

export interface PlantillaCompleta extends PlantillaResumen {
  definicion: DefinicionDocumento;
  campos_propios: CampoPropio[];
  fondo_nombre: string | null;
  fondo_paginas: PaginaFondo[];
}

export interface VersionPlantilla {
  id: string;
  numero: number;
  metadatos: Record<string, unknown>;
  definicion_sha256: string;
  publicada_en: string | null;
}

// ───────────────────────── Catálogo de variables ─────────────────────────

export type TipoVariable = "texto" | "fecha" | "si_no" | "imagen" | "coleccion";

export interface ColumnaColeccion {
  clave: string;
  etiqueta: string;
  ejemplo: string;
}

export interface VariableCatalogo {
  clave: string;
  etiqueta: string;
  descripcion: string;
  grupo: string;
  tipo: TipoVariable;
  ejemplo: unknown;
  columnas?: ColumnaColeccion[];
}

export interface CatalogoVariables {
  variables: VariableCatalogo[];
  tipos_bloque: string[];
  tipos_campo_overlay: string[];
  tipos_campo_propio: string[];
  modos: ModoPlantilla[];
  momentos: MomentoDocumento[];
  firmantes: FirmanteDocumento[];
  limites: { max_bytes_fondo: number; max_bytes_logo: number };
}

// ───────────────────────── Campos propios ─────────────────────────

export type TipoCampoPropio = "texto" | "texto_largo" | "fecha" | "si_no" | "opcion";

export interface CampoPropio {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoPropio;
  obligatorio: boolean;
  ayuda: string;
  opciones?: string[];
}

// ───────────────────────── Modo formulario ─────────────────────────

export type TamanoPagina = "carta" | "oficio";
export type OrientacionPagina = "vertical" | "horizontal";
export type TipoEncabezado = "institucional" | "logo_propio" | "ninguno";
export type AlineacionTexto = "izquierda" | "centro" | "derecha" | "justificado";
export type AlineacionCorta = "izquierda" | "centro" | "derecha";

export interface EncabezadoDocumento {
  tipo: TipoEncabezado;
  titulo: string;
  subtitulo: string;
  logo_clave?: string;
}

export interface CeldaFila {
  etiqueta: string;
  /** `null` = en blanco, para completar a mano. */
  variable: string | null;
  ancho: number;
}

export interface OpcionCasilla {
  valor: string;
  etiqueta: string;
}

export interface ColumnaTabla {
  variable: string;
  etiqueta: string;
  ancho: number;
}

export interface Firmante {
  etiqueta: string;
  detalle: string;
}

export type TipoBloque =
  | "seccion"
  | "fila_campos"
  | "casillas"
  | "tabla"
  | "parrafo"
  | "foto"
  | "firmas"
  | "salto_pagina";

export interface BloqueSeccion { id: string; tipo: "seccion"; titulo: string }
export interface BloqueFilaCampos { id: string; tipo: "fila_campos"; celdas: CeldaFila[]; alto_mm: number }
export interface BloqueCasillas {
  id: string;
  tipo: "casillas";
  etiqueta: string;
  variable: string;
  columnas: number;
  opciones: OpcionCasilla[];
}
export interface BloqueTabla {
  id: string;
  tipo: "tabla";
  titulo: string;
  coleccion: string;
  columnas: ColumnaTabla[];
  filas_minimas: number;
}
export interface BloqueParrafo { id: string; tipo: "parrafo"; texto: string; alineacion: AlineacionTexto }
export interface BloqueFoto {
  id: string;
  tipo: "foto";
  alineacion: AlineacionCorta;
  ancho_mm: number;
  alto_mm: number;
}
export interface BloqueFirmas { id: string; tipo: "firmas"; firmantes: Firmante[] }
export interface BloqueSaltoPagina { id: string; tipo: "salto_pagina" }

export type Bloque =
  | BloqueSeccion
  | BloqueFilaCampos
  | BloqueCasillas
  | BloqueTabla
  | BloqueParrafo
  | BloqueFoto
  | BloqueFirmas
  | BloqueSaltoPagina;

export interface DefinicionFormulario {
  pagina: { tamano: TamanoPagina; orientacion: OrientacionPagina };
  encabezado: EncabezadoDocumento;
  bloques: Bloque[];
}

// ───────────────────────── Modo pdf_overlay ─────────────────────────

export type TipoCampoOverlay = "texto" | "casilla" | "foto" | "tabla";
export type OperadorCondicion = "igual" | "distinto" | "no_vacio" | "vacio";

export interface GeometriaCampo { x: number; y: number; w: number; h: number }

export interface CampoTexto extends GeometriaCampo {
  id: string;
  tipo: "texto";
  texto: string;
  tamano: number;
  alineacion: AlineacionCorta;
  negrita: boolean;
}
export interface CondicionCasilla { variable: string; operador: OperadorCondicion; valor: string }
export interface CampoCasilla extends GeometriaCampo { id: string; tipo: "casilla"; condicion: CondicionCasilla }
export interface CampoFoto extends GeometriaCampo { id: string; tipo: "foto" }
export interface ColumnaOverlay { variable: string; dx: number; ancho: number; alineacion: AlineacionCorta }
export interface CampoTabla extends GeometriaCampo {
  id: string;
  tipo: "tabla";
  coleccion: string;
  columnas: ColumnaOverlay[];
  interlineado: number;
  filas_max: number;
  tamano: number;
}

export type CampoOverlay = CampoTexto | CampoCasilla | CampoFoto | CampoTabla;

export interface PaginaOverlay {
  origen: number;
  campos: CampoOverlay[];
}

export interface DefinicionOverlay {
  paginas: PaginaOverlay[];
}

export type DefinicionDocumento = DefinicionFormulario | DefinicionOverlay;

// ───────────────────────── Borrador editable ─────────────────────────

/** Todo lo que el editor modifica y que el PUT del borrador acepta. */
export interface BorradorPlantilla {
  codigo: string;
  nombre: string;
  descripcion: string;
  momento: MomentoDocumento;
  firmante: FirmanteDocumento;
  requiere_firma_clic: boolean;
  definicion: DefinicionDocumento;
  campos_propios: CampoPropio[];
}

export interface ErrorValidacion {
  /** Ruta con puntos, p. ej. `bloques.3.celdas.0.variable`. */
  ruta: string;
  mensaje: string;
}
