import {
  ESTADOS_FINALES,
  type SeccionAutogestionEntity,
  type SolicitudDetalleEntity,
  type SolicitudEntity,
} from "../entities/solicitud-actualizacion";

export interface TiempoRestante {
  vencida: boolean;
  totalSegundos: number;
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
}

/** Cuenta regresiva hasta `fin`. Sin fecha o inválida se trata como vencida. */
export function tiempoRestante(fin: string | null | undefined, ahora: Date): TiempoRestante {
  const t = fin ? new Date(fin).getTime() : Number.NaN;
  const total = Number.isNaN(t) ? 0 : Math.max(0, Math.floor((t - ahora.getTime()) / 1000));
  return {
    vencida: total <= 0,
    totalSegundos: total,
    dias: Math.floor(total / 86400),
    horas: Math.floor((total % 86400) / 3600),
    minutos: Math.floor((total % 3600) / 60),
    segundos: total % 60,
  };
}

/** Texto legible de la cuenta regresiva: "3 días y 4 h", "5 h 20 min", "Vencida". */
export function textoTiempoRestante(t: TiempoRestante): string {
  if (t.vencida) return "Plazo vencido";
  if (t.dias > 0) return `${t.dias} ${t.dias === 1 ? "día" : "días"} y ${t.horas} h`;
  if (t.horas > 0) return `${t.horas} h ${t.minutos} min`;
  return `${Math.max(t.minutos, 1)} min`;
}

/** El trabajador solo edita con la ventana HABILITADA y vigente. */
export function puedeEditarBorrador(solicitud: SolicitudEntity, ahora: Date): boolean {
  return solicitud.estado === "HABILITADA" && !tiempoRestante(solicitud.ventanaFin, ahora).vencida;
}

export function esFinal(solicitud: SolicitudEntity): boolean {
  return ESTADOS_FINALES.includes(solicitud.estado);
}

/** Bienestar solo habilita una solicitud SOLICITADA y prorroga una HABILITADA. */
export function puedeHabilitar(solicitud: SolicitudEntity): boolean {
  return solicitud.estado === "SOLICITADA";
}
export function puedeProrrogar(solicitud: SolicitudEntity): boolean {
  return solicitud.estado === "HABILITADA";
}
export function puedeDecidir(solicitud: SolicitudEntity): boolean {
  return solicitud.estado === "ENVIADA";
}
export function puedeRechazarTotal(solicitud: SolicitudEntity): boolean {
  return solicitud.estado === "SOLICITADA" || solicitud.estado === "ENVIADA";
}

/** Secciones habilitadas que exigen soporte y aún no tienen ninguno cargado. */
export function seccionesSinSoporte(
  detalle: Pick<SolicitudDetalleEntity, "seccionesHabilitadas" | "soportes">,
  catalogo: SeccionAutogestionEntity[],
): string[] {
  return detalle.seccionesHabilitadas.filter((codigo) => {
    const seccion = catalogo.find((s) => s.codigo === codigo);
    if (!seccion?.requiereSoporte) return false;
    return !detalle.soportes.some((s) => s.seccion === codigo);
  });
}

/** Verifica en cliente lo que el servidor exigirá al enviar. Devuelve mensajes en español. */
export function validarEnvio(
  detalle: Pick<SolicitudDetalleEntity, "seccionesHabilitadas" | "soportes" | "cambios">,
  catalogo: SeccionAutogestionEntity[],
): string[] {
  const errores: string[] = [];
  if (detalle.cambios.length === 0) {
    errores.push("Guarde al menos un cambio antes de enviar la solicitud.");
  }
  for (const codigo of seccionesSinSoporte(detalle, catalogo)) {
    const nombre = catalogo.find((s) => s.codigo === codigo)?.nombre ?? codigo;
    errores.push(`La sección «${nombre}» exige adjuntar al menos un soporte.`);
  }
  return errores;
}
