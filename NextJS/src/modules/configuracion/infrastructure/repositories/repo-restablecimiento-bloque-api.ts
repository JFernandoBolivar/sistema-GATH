import type {
  EstadoBloque,
  EstadoTareaBloque,
  SolicitudBloque,
  VistaPreviaBloque,
} from "../../domain/entities/restablecimiento-bloque";
import type { RepoRestablecimientoBloque } from "../../domain/ports/repo-restablecimiento-bloque";
import {
  restablecimientoBloqueApi,
  type EstadoBloqueApi,
  type SolicitudBloqueApi,
  type VistaPreviaBloqueApi,
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

export function vistaPreviaApiADTO(api: VistaPreviaBloqueApi): VistaPreviaBloque {
  return {
    revisadas: api.revisadas ?? 0,
    activos: api.activos ?? 0,
    pasivos: api.pasivos ?? 0,
    total: api.total ?? 0,
    omitidasAdministrativas: api.omitidas_administrativas ?? 0,
    muestra: (api.muestra ?? []).map((m) => ({
      cuentaId: m.cuenta_id,
      cedula: m.cedula,
      nombre: m.nombre,
      condicion: m.condicion,
      venceEn: m.vence_en ?? null,
    })),
    venceEnNuevo: api.vence_en_nuevo ?? null,
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
    taskId: api.task_id ?? "",
    estado,
    mensaje:
      api.mensaje ??
      (api.estado === "EN_CURSO" ? "Ya hay un restablecimiento en curso. Espere a que termine." : null),
    resultado: r
      ? {
          revisadas: r.revisadas ?? 0,
          restablecidas: r.restablecidas ?? 0,
          omitidas: r.omitidas_administrativas ?? r.omitidas ?? 0,
          errores: r.errores ?? 0,
          venceEnNuevo: r.vence_en_nuevo ?? null,
        }
      : null,
  };
}

export const repoRestablecimientoBloqueApi: RepoRestablecimientoBloque = {
  async vistaPrevia(solicitud) {
    const { data } = await restablecimientoBloqueApi.vistaPrevia(aApi(solicitud));
    return vistaPreviaApiADTO(data);
  },
  async ejecutar(solicitud, confirmacion) {
    const { data } = await restablecimientoBloqueApi.ejecutar({ ...aApi(solicitud), confirmacion });
    return estadoApiADTO(data);
  },
  async estado(taskId) {
    const { data } = await restablecimientoBloqueApi.estado(taskId);
    return estadoApiADTO(data);
  },
  excel(solicitud) {
    return restablecimientoBloqueApi.excel(solicitud.clasificacion, solicitud.alcance);
  },
};
