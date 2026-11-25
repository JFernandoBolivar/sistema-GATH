/**
 * Etapas visibles del expediente de Captación (auditoría UX, paso a paso opcional).
 *
 * Es solo presentación: el estado real y lo que se puede hacer salen del backend. Aquí se traduce el estado del
 * expediente a un recorrido de siete etapas y se marcan como «fuera del sistema» las etapas que este ingreso no
 * recorre dentro del sistema (Presupuesto o Dirección General desactivados en `flujo`).
 */
import type { FlujoIngreso } from "./ingreso-corto";

export type EstadoEtapa = "hecho" | "actual" | "pendiente" | "bloqueado" | "fuera_sistema";

export interface EtapaEtiqueta {
  id: "datos" | "revision" | "presupuesto" | "direccion" | "complementarios" | "revision_final" | "contratacion";
  titulo: string;
}

export interface EtapaExpediente extends EtapaEtiqueta {
  estado: EstadoEtapa;
  descripcion: string;
}

export interface EntradaEtapas {
  estado: string;
  flujo: FlujoIngreso;
  /** Asientos del historial (se usan solo para ubicar los estados finales). */
  historial?: readonly { estadoOrigen: string | null; estadoDestino: string }[];
  /** Ventana en curso: respaldo para ubicar un EXPIRADO sin historial. */
  ventana?: number | null;
}

export const ETAPAS: readonly EtapaEtiqueta[] = [
  { id: "datos", titulo: "Datos iniciales" },
  { id: "revision", titulo: "Revisión" },
  { id: "presupuesto", titulo: "Presupuesto" },
  { id: "direccion", titulo: "Dirección General" },
  { id: "complementarios", titulo: "Datos complementarios" },
  { id: "revision_final", titulo: "Revisión final" },
  { id: "contratacion", titulo: "Contratación" },
] as const;

/** Etapa en la que está (o en la que terminó) cada estado del expediente. */
const INDICE_POR_ESTADO: Record<string, number> = {
  PRE_REGISTRADO: 0,
  EN_CAPTURA: 0,
  ENVIADO_CAPTACION: 1,
  EN_CORRECCION_DATOS: 1,
  EN_PRESUPUESTO: 2,
  EN_CORRECCION_CARGO: 2,
  DIFERIDO_PRESUPUESTO: 2,
  EN_DIRECCION_GENERAL: 3,
  APROBADO: 4,
  CONSOLIDANDO: 4,
  EN_REVISION_FINAL: 5,
  LISTO_PARA_ASIGNAR: 6,
  CONTRATADO: 6,
  // Estados finales que siempre se cierran en una etapa conocida.
  RECHAZADO_CAPTACION: 1,
  RECHAZADO_DIRECCION: 3,
  DESISTIDO: 2,
};

const ESTADOS_FINALES = new Set(["RECHAZADO_CAPTACION", "RECHAZADO_DIRECCION", "EXPIRADO", "DESISTIDO"]);

const DESCRIPCION_ACTUAL: Record<string, string> = {
  PRE_REGISTRADO: "El postulante aún no ha comenzado a completar sus datos.",
  EN_CAPTURA: "El postulante está completando y guardando sus datos iniciales.",
  ENVIADO_CAPTACION: "Captación revisa los datos que envió el postulante.",
  EN_CORRECCION_DATOS: "Captación devolvió observaciones y el postulante debe corregir sus datos.",
  EN_PRESUPUESTO: "Presupuesto revisa la solicitud, reserva el puesto y declara la disponibilidad.",
  EN_CORRECCION_CARGO: "Presupuesto devolvió la propuesta para corregir el cargo o la oficina.",
  DIFERIDO_PRESUPUESTO: "El expediente espera disponibilidad presupuestaria.",
  EN_DIRECCION_GENERAL: "La Dirección General decide sobre el Punto de Cuenta del ingreso.",
  APROBADO: "El ingreso fue aprobado; falta abrir la Ventana 2.",
  CONSOLIDANDO: "El postulante completa sus datos complementarios (Ventana 2).",
  EN_REVISION_FINAL: "Captación revisa la Ventana 2 y los documentos del postulante.",
  LISTO_PARA_ASIGNAR: "El expediente está listo: falta asignar el cargo y contratar.",
  CONTRATADO: "La contratación se completó y el expediente quedó cerrado.",
};

function indiceDelEstado(estado: string): number | null {
  return Object.prototype.hasOwnProperty.call(INDICE_POR_ESTADO, estado) ? INDICE_POR_ESTADO[estado] : null;
}

function indiceDesdeHistorial(entrada: EntradaEtapas): number {
  let mayor = -1;
  for (const asiento of entrada.historial ?? []) {
    const destino = indiceDelEstado(asiento.estadoDestino);
    const origen = indiceDelEstado(asiento.estadoOrigen ?? "");
    if (destino !== null) mayor = Math.max(mayor, destino);
    if (origen !== null) mayor = Math.max(mayor, origen);
  }
  if (mayor >= 0) return mayor;
  // Sin historial: la ventana 2 implica que al menos llegó a los datos complementarios.
  if (entrada.estado === "EXPIRADO" && entrada.ventana === 2) return 4;
  return 0;
}

/**
 * Recorrido del expediente: anteriores «hechas», la actual «en curso», posteriores «pendientes» y las etapas
 * desactivadas en `flujo` como «fuera del sistema».
 */
export function etapasExpediente(entrada: EntradaEtapas): EtapaExpediente[] {
  const esFinal = ESTADOS_FINALES.has(entrada.estado);
  const indiceActual =
    indiceDelEstado(entrada.estado) ?? (esFinal ? indiceDesdeHistorial(entrada) : 0);

  return ETAPAS.map((etapa, i) => {
    const fueraDelSistema =
      (etapa.id === "presupuesto" && !entrada.flujo.requierePresupuesto) ||
      (etapa.id === "direccion" && !entrada.flujo.requiereDireccionGeneral);

    if (fueraDelSistema) {
      return {
        ...etapa,
        estado: "fuera_sistema",
        descripcion: "Esta etapa no está configurada para este ingreso: se gestiona fuera del sistema.",
      };
    }
    if (i < indiceActual) {
      return { ...etapa, estado: "hecho", descripcion: "Completada." };
    }
    if (i === indiceActual) {
      if (entrada.estado === "RECHAZADO_CAPTACION") {
        return { ...etapa, estado: "actual", descripcion: "El expediente se cerró: Captación rechazó la postulación." };
      }
      if (entrada.estado === "RECHAZADO_DIRECCION") {
        return { ...etapa, estado: "actual", descripcion: "El expediente se cerró: Dirección General rechazó el ingreso." };
      }
      if (entrada.estado === "EXPIRADO") {
        return { ...etapa, estado: "actual", descripcion: "El plazo del expediente venció: quedó cerrado en esta etapa." };
      }
      if (entrada.estado === "DESISTIDO") {
        return { ...etapa, estado: "actual", descripcion: "El expediente se cerró por desistimiento." };
      }
      return {
        ...etapa,
        estado: "actual",
        descripcion: DESCRIPCION_ACTUAL[entrada.estado] ?? "Etapa actual del expediente.",
      };
    }
    return { ...etapa, estado: "pendiente", descripcion: "Aún no ha comenzado." };
  });
}
