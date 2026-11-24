/**
 * Ventana 2 del postulante (consolidación del expediente tras la aprobación): familiares, vivienda, salud,
 * tallas y foto de carnet. Espejo de `domain/services/datos_ventana2.py` del backend. Todo viaja por id de
 * catálogo; en el formulario los ids son texto (`""` = sin elegir).
 */

export const MAX_FAMILIARES = 20;

export const LIMITES_VENTANA2 = {
  nombre: 150,
  cedula: 10,
  direccion: 300,
  ciudad: 120,
  ordenMin: 1,
  ordenMax: 99,
  edadMaximaFamiliar: 120,
} as const;

export type SeccionVentana2 = "familiares" | "vivienda" | "salud" | "tallas" | "foto" | "revisar";

export interface DefinicionSeccion {
  id: SeccionVentana2;
  etiqueta: string;
  /** Sección del backend que cubre (`faltantes[].seccion`). */
  seccionApi: string;
}

export const SECCIONES_VENTANA2: readonly DefinicionSeccion[] = [
  { id: "familiares", etiqueta: "Familiares", seccionApi: "familiares" },
  { id: "vivienda", etiqueta: "Vivienda", seccionApi: "vivienda" },
  { id: "salud", etiqueta: "Salud", seccionApi: "salud" },
  { id: "tallas", etiqueta: "Tallas", seccionApi: "tallas" },
  { id: "foto", etiqueta: "Foto", seccionApi: "foto" },
  { id: "revisar", etiqueta: "Revisar y enviar", seccionApi: "" },
];

/** Secciones con contenido propio (las que pueden estar completas o con faltantes). */
export const SECCIONES_CON_DATOS = SECCIONES_VENTANA2.filter((s) => s.id !== "revisar");

// --- Catálogos ---
export interface OpcionCatalogo {
  id: number;
  nombre: string;
}

export interface ParentescoCatalogo extends OpcionCatalogo {
  esHijo: boolean;
  menorACargo: boolean;
  sinCedulaHastaEdad: number | null;
  permiteOrdenHijo: boolean;
}

export interface TallaCatalogo {
  id: number;
  valor: string;
  region: string;
}

export interface CatalogosVentana2 {
  parentescos: ParentescoCatalogo[];
  sexos: OpcionCatalogo[];
  condicionesVivienda: OpcionCatalogo[];
  estados: OpcionCatalogo[];
  municipios: OpcionCatalogo[];
  parroquias: OpcionCatalogo[];
  gruposSanguineos: OpcionCatalogo[];
  alergias: OpcionCatalogo[];
  patologiasCronicas: OpcionCatalogo[];
  discapacidades: OpcionCatalogo[];
  tallas: { camisa: TallaCatalogo[]; pantalon: TallaCatalogo[]; calzado: TallaCatalogo[]; chaqueta: TallaCatalogo[] };
}

export const CATALOGOS_VACIOS: CatalogosVentana2 = {
  parentescos: [],
  sexos: [],
  condicionesVivienda: [],
  estados: [],
  municipios: [],
  parroquias: [],
  gruposSanguineos: [],
  alergias: [],
  patologiasCronicas: [],
  discapacidades: [],
  tallas: { camisa: [], pantalon: [], calzado: [], chaqueta: [] },
};

// --- Valores del formulario (todo texto; vacío = no informado) ---
export interface ValoresFamiliar {
  primerNombre: string;
  segundoNombre: string;
  primerApellido: string;
  segundoApellido: string;
  cedula: string;
  ordenHijo: string;
  parentescoId: string;
  sexoId: string;
  fechaNacimiento: string;
  /** `"si"` | `"no"` | `""`. */
  dependeEconomicamente: string;
}

export interface ValoresFamiliares {
  sinFamiliares: boolean;
  familiares: ValoresFamiliar[];
}

export interface ValoresVivienda {
  condicionViviendaId: string;
  estadoId: string;
  municipioId: string;
  parroquiaId: string;
  direccionExacta: string;
  ciudadRegion: string;
}

export interface ValoresSalud {
  grupoSanguineoId: string;
  alergias: number[];
  patologiasCronicas: number[];
  discapacidades: number[];
}

export interface ValoresTallas {
  tallaCamisaId: string;
  tallaPantalonId: string;
  tallaZapatosId: string;
  tallaChaquetaId: string;
}

export const FAMILIAR_VACIO: ValoresFamiliar = {
  primerNombre: "",
  segundoNombre: "",
  primerApellido: "",
  segundoApellido: "",
  cedula: "",
  ordenHijo: "",
  parentescoId: "",
  sexoId: "",
  fechaNacimiento: "",
  dependeEconomicamente: "",
};

type Crudo = Record<string, unknown>;
const objeto = (v: unknown): Crudo => (v && typeof v === "object" && !Array.isArray(v) ? (v as Crudo) : {});
const texto = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const listaIds = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []);

export function familiaresDesdeDatos(datos: Crudo): ValoresFamiliares {
  const lista = Array.isArray(datos.familiares) ? datos.familiares : [];
  return {
    sinFamiliares: datos.sin_familiares === true,
    familiares: lista.map((item) => {
      const f = objeto(item);
      return {
        primerNombre: texto(f.primer_nombre),
        segundoNombre: texto(f.segundo_nombre),
        primerApellido: texto(f.primer_apellido),
        segundoApellido: texto(f.segundo_apellido),
        cedula: texto(f.cedula),
        ordenHijo: texto(f.orden_hijo),
        parentescoId: texto(f.parentesco_id),
        sexoId: texto(f.sexo_id),
        fechaNacimiento: texto(f.fecha_nacimiento),
        dependeEconomicamente: f.depende_economicamente === true ? "si" : f.depende_economicamente === false ? "no" : "",
      };
    }),
  };
}

export function viviendaDesdeDatos(datos: Crudo): ValoresVivienda {
  const v = objeto(datos.vivienda);
  return {
    condicionViviendaId: texto(v.condicion_vivienda_id),
    estadoId: texto(v.estado_id),
    municipioId: texto(v.municipio_id),
    parroquiaId: texto(v.parroquia_id),
    direccionExacta: texto(v.direccion_exacta),
    ciudadRegion: texto(v.ciudad_region),
  };
}

export function saludDesdeDatos(datos: Crudo): ValoresSalud {
  const s = objeto(datos.salud);
  return {
    grupoSanguineoId: texto(s.grupo_sanguineo_id),
    alergias: listaIds(s.alergias),
    patologiasCronicas: listaIds(s.patologias_cronicas),
    discapacidades: listaIds(s.discapacidades),
  };
}

export function tallasDesdeDatos(datos: Crudo): ValoresTallas {
  const t = objeto(datos.tallas);
  return {
    tallaCamisaId: texto(t.talla_camisa_id),
    tallaPantalonId: texto(t.talla_pantalon_id),
    tallaZapatosId: texto(t.talla_zapatos_id),
    tallaChaquetaId: texto(t.talla_chaqueta_id),
  };
}

// --- Cuerpos del PUT (solo la sección enviada; sin claves vacías) ---
const recortado = (v: string) => v.trim().replace(/\s+/g, " ");
const aId = (v: string): number | undefined => (/^\d+$/.test(v) ? Number(v) : undefined);

export function cuerpoFamiliares(v: ValoresFamiliares): Record<string, unknown> {
  if (v.sinFamiliares) return { sin_familiares: true, familiares: [] };
  return {
    sin_familiares: false,
    familiares: v.familiares.map((f) => {
      const salida: Record<string, unknown> = {};
      const poner = (clave: string, valor: unknown) => {
        if (valor !== undefined && valor !== "") salida[clave] = valor;
      };
      poner("primer_nombre", recortado(f.primerNombre));
      poner("segundo_nombre", recortado(f.segundoNombre));
      poner("primer_apellido", recortado(f.primerApellido));
      poner("segundo_apellido", recortado(f.segundoApellido));
      poner("cedula", f.cedula.trim().toUpperCase());
      poner("orden_hijo", f.cedula.trim() ? undefined : aId(f.ordenHijo));
      poner("parentesco_id", aId(f.parentescoId));
      poner("sexo_id", aId(f.sexoId));
      poner("fecha_nacimiento", f.fechaNacimiento);
      if (f.dependeEconomicamente) salida.depende_economicamente = f.dependeEconomicamente === "si";
      return salida;
    }),
  };
}

export function cuerpoVivienda(v: ValoresVivienda): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  const poner = (clave: string, valor: unknown) => {
    if (valor !== undefined && valor !== "") salida[clave] = valor;
  };
  poner("condicion_vivienda_id", aId(v.condicionViviendaId));
  poner("estado_id", aId(v.estadoId));
  poner("municipio_id", aId(v.municipioId));
  poner("parroquia_id", aId(v.parroquiaId));
  poner("direccion_exacta", recortado(v.direccionExacta));
  poner("ciudad_region", recortado(v.ciudadRegion));
  return salida;
}

export function cuerpoSalud(v: ValoresSalud): Record<string, unknown> {
  const salida: Record<string, unknown> = {
    alergias: v.alergias,
    patologias_cronicas: v.patologiasCronicas,
    discapacidades: v.discapacidades,
  };
  const grupo = aId(v.grupoSanguineoId);
  if (grupo) salida.grupo_sanguineo_id = grupo;
  return salida;
}

export function cuerpoTallas(v: ValoresTallas): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  const poner = (clave: string, valor: string) => {
    const id = aId(valor);
    if (id) salida[clave] = id;
  };
  poner("talla_camisa_id", v.tallaCamisaId);
  poner("talla_pantalon_id", v.tallaPantalonId);
  poner("talla_zapatos_id", v.tallaZapatosId);
  poner("talla_chaqueta_id", v.tallaChaquetaId);
  return salida;
}

// --- Reglas del familiar (espejo de `validaciones_familiar.py`) ---
export const EDAD_SIN_CEDULA_POR_DEFECTO = 9;

export function edadEnAnios(fechaIso: string, hoy: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIso)) return null;
  const [a, m, d] = fechaIso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) return null;
  const mesHoy = hoy.getUTCMonth() + 1;
  const diaHoy = hoy.getUTCDate();
  return hoy.getUTCFullYear() - a - (mesHoy < m || (mesHoy === m && diaHoy < d) ? 1 : 0);
}

export interface ReglaCedulaFamiliar {
  /** Puede registrarse sin cédula (hijo o menor a cargo por debajo de la edad límite). */
  puedeSinCedula: boolean;
  /** Edad límite (años) por debajo de la cual no necesita cédula. */
  edadLimite: number;
  /** Sin cédula, hay que indicar el orden de nacimiento. */
  requiereOrden: boolean;
}

export function reglaCedulaFamiliar(
  parentesco: ParentescoCatalogo | undefined,
  fechaNacimiento: string,
  hoy: Date,
): ReglaCedulaFamiliar {
  const edadLimite = parentesco?.sinCedulaHastaEdad ?? EDAD_SIN_CEDULA_POR_DEFECTO;
  const edad = edadEnAnios(fechaNacimiento, hoy);
  const aplica = !!parentesco && (parentesco.esHijo || parentesco.menorACargo) && edad !== null && edad < edadLimite;
  return { puedeSinCedula: aplica, edadLimite, requiereOrden: aplica && !!parentesco?.permiteOrdenHijo };
}

/** ¿El parentesco admite la regla «sin cédula» en algún caso? (para mostrar la ayuda del campo). */
export function parentescoAdmiteSinCedula(parentesco: ParentescoCatalogo | undefined): boolean {
  return !!parentesco && (parentesco.esHijo || parentesco.menorACargo);
}

// --- Faltantes y avance ---
export interface Faltante {
  seccion: string;
  campo: string;
  mensaje: string;
}

export interface AvanceSeccion {
  id: SeccionVentana2;
  etiqueta: string;
  completa: boolean;
  faltantes: Faltante[];
}

export interface AvanceVentana2 {
  secciones: AvanceSeccion[];
  completas: number;
  total: number;
  porcentaje: number;
  todoCompleto: boolean;
}

/** Avance por sección a partir de los faltantes que informa el backend (la fuente de verdad). */
export function calcularAvance(faltantes: readonly Faltante[]): AvanceVentana2 {
  const secciones = SECCIONES_CON_DATOS.map<AvanceSeccion>((s) => {
    const propios = faltantes.filter((f) => f.seccion === s.seccionApi);
    return { id: s.id, etiqueta: s.etiqueta, completa: propios.length === 0, faltantes: propios };
  });
  const completas = secciones.filter((s) => s.completa).length;
  return {
    secciones,
    completas,
    total: secciones.length,
    porcentaje: Math.round((completas / secciones.length) * 100),
    todoCompleto: completas === secciones.length,
  };
}

/** Sección del formulario a la que lleva un faltante (`sin_familiares` pertenece a familiares). */
export function seccionDeFaltante(f: Faltante): SeccionVentana2 {
  return SECCIONES_CON_DATOS.find((s) => s.seccionApi === f.seccion)?.id ?? "revisar";
}

// --- Errores del servidor ---
const CODIGOS_VENTANA2: Record<string, string> = {
  VENTANA_INCORRECTA: "Este formulario ya no está disponible para tu expediente. Recarga la página.",
  VENTANA_VENCIDA: "El plazo para completar tus datos venció. Comunícate con Captación para que te habiliten uno nuevo.",
  VENTANA2_INCOMPLETA: "Todavía faltan datos para poder enviar. Revisa la lista de pendientes.",
  DATOS_INVALIDOS: "Hay datos que no son válidos. Revisa los campos marcados.",
};

/** Mensaje en lenguaje claro para un código de error de la Ventana 2 (o `null` si no lo conocemos). */
export function mensajeDeCodigoVentana2(codigo: string | undefined | null): string | null {
  return (codigo && CODIGOS_VENTANA2[codigo]) || null;
}

/**
 * Convierte una ruta del backend (`familiares.0.cedula`, `vivienda.estado_id`) en el nombre del campo del
 * formulario de esa sección (`familiares.0.cedula`, `estadoId`).
 */
const CAMPO_POR_CLAVE_API: Record<string, string> = {
  primer_nombre: "primerNombre",
  segundo_nombre: "segundoNombre",
  primer_apellido: "primerApellido",
  segundo_apellido: "segundoApellido",
  cedula: "cedula",
  orden_hijo: "ordenHijo",
  parentesco_id: "parentescoId",
  sexo_id: "sexoId",
  fecha_nacimiento: "fechaNacimiento",
  depende_economicamente: "dependeEconomicamente",
  condicion_vivienda_id: "condicionViviendaId",
  estado_id: "estadoId",
  municipio_id: "municipioId",
  parroquia_id: "parroquiaId",
  direccion_exacta: "direccionExacta",
  ciudad_region: "ciudadRegion",
  grupo_sanguineo_id: "grupoSanguineoId",
  alergias: "alergias",
  patologias_cronicas: "patologiasCronicas",
  discapacidades: "discapacidades",
  talla_camisa_id: "tallaCamisaId",
  talla_pantalon_id: "tallaPantalonId",
  talla_zapatos_id: "tallaZapatosId",
  talla_chaqueta_id: "tallaChaquetaId",
};

export interface ErrorDeCampo {
  seccion: SeccionVentana2 | null;
  /** Ruta del campo dentro del formulario de la sección. */
  campo: string;
}

export function campoDeRutaApi(ruta: string): ErrorDeCampo {
  const partes = ruta.replace(/^datos_ventana2\./, "").split(".");
  const seccion = SECCIONES_CON_DATOS.find((s) => s.seccionApi === partes[0])?.id ?? null;
  if (partes[0] === "familiares" && partes.length >= 3) {
    return { seccion, campo: `familiares.${partes[1]}.${CAMPO_POR_CLAVE_API[partes[2]] ?? partes[2]}` };
  }
  if (partes[0] === "familiares" || partes[0] === "sin_familiares") return { seccion: "familiares", campo: "familiares" };
  const clave = partes[1] ?? partes[0];
  return { seccion, campo: CAMPO_POR_CLAVE_API[clave] ?? clave };
}

// --- Foto de carnet ---
export const FOTO = {
  maxBytes: 5 * 1024 * 1024,
  minLado: 300,
  tipos: ["image/jpeg", "image/png"],
} as const;

export function validarTipoYTamanoFoto(archivo: { type: string; size: number }): string | null {
  if (!(FOTO.tipos as readonly string[]).includes(archivo.type)) {
    return "La foto debe ser una imagen JPEG o PNG.";
  }
  if (archivo.size <= 0) return "El archivo está vacío.";
  if (archivo.size > FOTO.maxBytes) return "La foto pesa más de 5 MB. Elige una más liviana.";
  return null;
}

export function validarDimensionesFoto(ancho: number, alto: number): string | null {
  if (ancho < FOTO.minLado || alto < FOTO.minLado) {
    return `La foto es muy pequeña (${ancho}x${alto}). Debe medir al menos ${FOTO.minLado}x${FOTO.minLado} píxeles.`;
  }
  return null;
}

export function formatearTamanoFoto(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
