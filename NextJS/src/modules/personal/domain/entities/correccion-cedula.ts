/** Corrección de la cédula de un trabajador: tipos del dominio. */
export type CondicionTrabajador = "ACTIVO" | "PASIVO" | "SIN_ASIGNACION";

export interface SolicitudCorreccionCedula {
  cedulaActual: string;
  cedulaNueva: string;
}

export interface RegistroAfectado {
  tabla: string;
  registros: number;
}

export interface VistaPreviaCorreccionCedula {
  trabajador: { cedulaActual: string; nombre: string; condicion: CondicionTrabajador };
  cedulaNueva: string;
  cuenta: { existe: boolean; correo: string | null; claveInicialPendiente: boolean };
  afectados: RegistroAfectado[];
  totalRegistros: number;
}

export interface EjecucionCorreccionCedula extends SolicitudCorreccionCedula {
  motivo: string;
  confirmacion: string;
}

export interface ResultadoCorreccionCedula {
  cedulaAnterior: string;
  cedulaNueva: string;
  afectados: RegistroAfectado[];
  totalRegistros: number;
  claveInicialActualizada: boolean;
}
