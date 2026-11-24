import type { DefinicionDocumento, DefinicionFormulario, DefinicionOverlay, ErrorValidacion, ModoPlantilla } from "../entities/plantilla";

/** El backend a veces antepone `definicion.`: se quita para tener una sola forma de ruta. */
export function normalizarRuta(ruta: string): string {
  return ruta.replace(/^definicion\./, "");
}

export interface UbicacionError {
  /** Bloque afectado (modo formulario). */
  bloqueId?: string;
  /** Página (índice) y campo afectados (modo overlay). */
  paginaIdx?: number;
  campoId?: string;
  /** Índice del campo propio afectado. */
  campoPropioIdx?: number;
  /** El error es del encabezado o de la página (ajustes del documento). */
  ajustes?: boolean;
}

/** Traduce la ruta de un error al bloque/campo del borrador para marcarlo en pantalla. */
export function ubicarError(ruta: string, modo: ModoPlantilla, definicion: DefinicionDocumento): UbicacionError {
  const partes = normalizarRuta(ruta).split(".");
  if (partes[0] === "campos_propios" && partes[1] !== undefined && /^\d+$/.test(partes[1])) {
    return { campoPropioIdx: Number(partes[1]) };
  }
  if (modo === "formulario") {
    if (partes[0] === "bloques" && /^\d+$/.test(partes[1] ?? "")) {
      const b = (definicion as DefinicionFormulario).bloques?.[Number(partes[1])];
      return b ? { bloqueId: b.id } : {};
    }
    if (partes[0] === "encabezado" || partes[0] === "pagina") return { ajustes: true };
    return {};
  }
  if (partes[0] === "paginas" && /^\d+$/.test(partes[1] ?? "")) {
    const paginaIdx = Number(partes[1]);
    if (partes[2] === "campos" && /^\d+$/.test(partes[3] ?? "")) {
      const c = (definicion as DefinicionOverlay).paginas?.[paginaIdx]?.campos?.[Number(partes[3])];
      return { paginaIdx, campoId: c?.id };
    }
    return { paginaIdx };
  }
  return {};
}

/** Une los errores del servidor (`{ruta: [mensajes]}`) con la forma de la validación local. */
export function erroresDeServidor(errores: Record<string, string[]> | undefined): ErrorValidacion[] {
  return Object.entries(errores ?? {}).flatMap(([ruta, mensajes]) =>
    mensajes.map((mensaje) => ({ ruta: normalizarRuta(ruta), mensaje })),
  );
}

/** Mensajes por ruta, para marcar el campo concreto (la primera incidencia gana). */
export function erroresPorRuta(errores: ErrorValidacion[]): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const e of errores) if (!(e.ruta in salida)) salida[e.ruta] = e.mensaje;
  return salida;
}
