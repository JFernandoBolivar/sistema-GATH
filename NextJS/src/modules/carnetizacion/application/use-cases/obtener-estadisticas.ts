/**
 * Caso de uso de Estadísticas de Carnetización (Reglas R2, R4).
 */
import type { EstadisticasCarnet } from "../../domain/entities/carnet";
import type { RepoCarnetizacion } from "../../domain/ports/repo-carnetizacion";
import type { EstadisticasCarnetDTO } from "../dtos/carnet-dto";

function aEstadisticasDTO(e: EstadisticasCarnet): EstadisticasCarnetDTO {
  return {
    total: e.total,
    activos: e.activos,
    revocados: e.revocados,
    emitidosHoy: e.emitidosHoy,
    emitidosMes: e.emitidosMes,
    porMotivo: e.porMotivo.map((m) => ({
      motivoId: m.motivoId,
      motivo: m.motivo,
      total: m.total,
    })),
  };
}

export async function obtenerEstadisticas(repo: RepoCarnetizacion): Promise<EstadisticasCarnetDTO> {
  const entidades = await repo.obtenerEstadisticas();
  return aEstadisticasDTO(entidades);
}
