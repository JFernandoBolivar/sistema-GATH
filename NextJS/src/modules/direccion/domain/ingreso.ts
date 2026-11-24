/** Pestañas y reglas de presentación de la bandeja de Dirección General (E-6). */
import type { DefinicionPestana } from "@/modules/presupuesto/domain/solicitud";

export type PestanaDireccion = "pendientes" | "historico";

export const PESTANAS_DIRECCION: DefinicionPestana<PestanaDireccion>[] = [
  { id: "pendientes", etiqueta: "Pendientes", estados: [], vista: "pendientes" },
  { id: "historico", etiqueta: "Histórico", estados: [], vista: "historico" },
];

/** Destino con el que se aprueba (el resto de destinos de Dirección son rechazos). */
export const DESTINO_APROBAR = "APROBADO";
export const DESTINO_RECHAZAR = "RECHAZADO_DIRECCION";
