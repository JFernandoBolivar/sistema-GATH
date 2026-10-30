import type { ConstanciaVerificadaEntity } from "../../domain/entities/verificacion-constancia";
import type { VerificacionApi } from "../http/fe-de-vida-api";

export function mapperVerificacion(v: VerificacionApi): ConstanciaVerificadaEntity {
  const oculta = v.cedula === undefined;
  return {
    numero: v.numero,
    emitidaEn: v.emitida_en ?? null,
    procesoNombre: v.proceso_nombre ?? "",
    nombreCompleto: v.nombre_completo ?? "",
    cedula: (oculta ? v.cedula_enmascarada : v.cedula) ?? "",
    cedulaOculta: oculta,
    solicitudId: v.solicitud_id || null,
    certificantes: (v.certificada_por ?? []).map((c) => ({ nombre: c.nombre, cedula: c.cedula })),
  };
}
