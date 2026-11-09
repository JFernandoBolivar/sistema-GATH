import type {
  NotificacionEntity,
  PaginaNotificacionesEntity,
} from "../../domain/entities/notificacion";
import type { NotificacionApi, PaginaNotificacionesApi } from "../http/notificaciones-api";

export function mapperNotificacion(api: NotificacionApi): NotificacionEntity {
  return {
    id: api.id,
    tipo: api.tipo,
    titulo: api.titulo,
    mensaje: api.mensaje ?? "",
    enlace: api.enlace ?? "",
    refTipo: api.ref_tipo ?? "",
    refId: api.ref_id ?? "",
    leida: Boolean(api.leida),
    fechaLectura: api.fecha_lectura ?? null,
    creadaEn: api.creada_en,
  };
}

export function mapperPaginaNotificaciones(
  api: PaginaNotificacionesApi,
): PaginaNotificacionesEntity {
  return {
    total: api.count,
    limite: api.limit,
    desplazamiento: api.offset,
    resultados: api.results.map(mapperNotificacion),
  };
}
