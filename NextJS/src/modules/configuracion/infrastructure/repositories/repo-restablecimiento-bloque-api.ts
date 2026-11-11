import type {
  EstadoBloque,
  EstadoTareaBloque,
  SolicitudBloque,
} from "../../domain/entities/restablecimiento-bloque";
import type { RepoRestablecimientoBloque } from "../../domain/ports/repo-restablecimiento-bloque";
import {
  restablecimientoBloqueApi,
  type EstadoBloqueApi,
  type SolicitudBloqueApi,
} from "../http/restablecimiento-bloque-api";

const ESTADOS: EstadoTareaBloque[] = ["EN_PROCESO", "LISTO", "ERROR", "CANCELADO"];

function aApi(s: SolicitudBloque): SolicitudBloqueApi {
  return {
    clasificacion: s.clasificacion,
    alcance: s.alcance,
    enviar_correo: s.enviarCorreo,
    motivo: s.motivo,
  };
}

export function estadoApiADTO(api: EstadoBloqueApi): EstadoBloque {
  // La tarea puede terminar con CONFLICTO (confirmación inválida) o EN_CURSO (otro lote
  // tenía el candado): ambos son finales para esta ejecución y se muestran como error.
  const final = api.estado === "CONFLICTO" || api.estado === "EN_CURSO";
  const estado: EstadoTareaBloque = final
    ? "ERROR"
    : ESTADOS.includes(api.estado as EstadoTareaBloque)
      ? (api.estado as EstadoTareaBloque)
      : "EN_PROCESO";
  const r = api.resultado;
  return {
    taskId: api.task_id,
    estado,
    mensaje:
      api.mensaje ??
      (api.estado === "EN_CURSO" ? "Ya hay un restablecimiento en curso. Espere a que termine." : null),
    resultado: r
      ? {
          revisadas: r.revisadas ?? 0,
          restablecidas: r.restablecidas ?? 0,
          omitidas: r.omitidas ?? r.omitidas_administrativas ?? 0,
          errores: r.errores ?? 0,
          activos: r.activos ?? 0,
          pasivos: r.pasivos ?? 0,
          total: r.total ?? (r.activos ?? 0) + (r.pasivos ?? 0),
        }
      : null,
  };
}

export const repoRestablecimientoBloqueApi: RepoRestablecimientoBloque = {
  async vistaPrevia(solicitud) {
    const { data } = await restablecimientoBloqueApi.vistaPrevia(aApi(solicitud));
    return estadoApiADTO(data);
  },
  async ejecutar(solicitud, confirmacion) {
    const { data } = await restablecimientoBloqueApi.ejecutar({ ...aApi(solicitud), confirmacion });
    return estadoApiADTO(data);
  },
  async estado(taskId) {
    const { data } = await restablecimientoBloqueApi.estado(taskId);
    return estadoApiADTO(data);
  },
};
