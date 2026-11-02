/**
 * Caso de uso de alta inline de catálogos del familiar ("Otra X" del legado)
 * (Reglas R2, R4). Mismo comportamiento que
 * `modules/personal/application/use-cases/resolver-altas-inline.ts`: busca
 * primero un registro con el mismo nombre bajo el mismo padre y solo si no
 * existe lo crea, para que escribir "Otra" con un nombre que ya existe
 * reutilice el registro en vez de fallar con 409.
 */
import type { RepoCatalogosAltaInlineFamiliar, TipoCatalogoInlineFamiliar } from "../../domain/ports/catalogos-alta-inline-familiar";
import type { CatalogoFamiliarDTO } from "../dtos/familiar-dto";

export interface SolicitudAltaInlineFamiliar {
  tipo: TipoCatalogoInlineFamiliar;
  nombre: string;
  padreId?: number | null;
}

const REQUIERE_PADRE: Record<TipoCatalogoInlineFamiliar, boolean> = {
  carreras: true,
  menciones: true,
  instituciones: false,
};

const normalizarNombre = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase();

export async function resolverAltasInlineFamiliar(
  repo: RepoCatalogosAltaInlineFamiliar,
  solicitudes: SolicitudAltaInlineFamiliar[],
): Promise<CatalogoFamiliarDTO[]> {
  const resueltos = new Map<string, CatalogoFamiliarDTO>();
  const listas = new Map<string, Promise<CatalogoFamiliarDTO[]>>();
  const resultado: CatalogoFamiliarDTO[] = [];

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
