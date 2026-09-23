/**
 * Caso de uso de alta inline de catálogos ("Otra X" del legado) (Reglas R2, R4).
 *
 * Para cada solicitud busca primero un registro con el mismo nombre (sin
 * distinguir mayúsculas/acentos ni espacios sobrantes) bajo el mismo padre y
 * solo si no existe lo crea; así escribir "Otra" con un nombre que ya existe
 * reutiliza el registro en vez de fallar con 409. Solicitudes repetidas en un
 * mismo envío se resuelven una sola vez.
 */
import type { RepoCatalogosAltaInline, TipoCatalogoInline } from "../../domain/ports/catalogos-alta-inline";
import type { CatalogoEmpleadoDTO } from "../dtos/empleado-dto";

export interface SolicitudAltaInline {
  tipo: TipoCatalogoInline;
  nombre: string;
  padreId?: number | null;
}

const REQUIERE_PADRE: Record<TipoCatalogoInline, boolean> = {
  carreras: true,
  menciones: true,
  instituciones: false,
  capacitaciones: false,
};

export const normalizarNombre = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

export async function resolverAltasInline(
  repo: RepoCatalogosAltaInline,
  solicitudes: SolicitudAltaInline[],
): Promise<CatalogoEmpleadoDTO[]> {
  const resueltos = new Map<string, CatalogoEmpleadoDTO>();
  const listas = new Map<string, Promise<CatalogoEmpleadoDTO[]>>();
  const resultado: CatalogoEmpleadoDTO[] = [];

  for (const s of solicitudes) {
    const nombre = s.nombre.trim().replace(/\s+/g, " ");
    if (!nombre) throw new Error("El nombre del nuevo registro no puede estar vacío.");
    if (nombre.length > 200) throw new Error("El nombre del nuevo registro no puede superar los 200 caracteres.");
    const padreId = REQUIERE_PADRE[s.tipo] ? (s.padreId ?? null) : null;
    if (REQUIERE_PADRE[s.tipo] && !(padreId && padreId > 0)) {
      throw new Error(s.tipo === "carreras" ? "Seleccione el nivel académico de la nueva carrera." : "Seleccione la carrera de la nueva mención.");
    }

    const clave = `${s.tipo}|${padreId ?? ""}|${normalizarNombre(nombre)}`;
    let item = resueltos.get(clave);
    if (!item) {
      const claveLista = `${s.tipo}|${padreId ?? ""}`;
      if (!listas.has(claveLista)) listas.set(claveLista, repo.listar(s.tipo, padreId));
      const existentes = await listas.get(claveLista)!;
      const existente = existentes.find((e) => normalizarNombre(e.nombre) === normalizarNombre(nombre));
      const obtenido = existente ?? (await repo.crear(s.tipo, nombre, padreId));
      item = { id: obtenido.id, nombre: obtenido.nombre };
      resueltos.set(clave, item);
    }
    resultado.push(item);
  }
  return resultado;
}
