import type { ModuloNotificaciones } from "../domain/entities/notificacion";

export interface TipoNotificacion {
  codigo: string;
  etiqueta: string;
}

const AUTOGESTION: TipoNotificacion[] = [
  { codigo: "autogestion.ventana_habilitada", etiqueta: "Actualización habilitada" },
  { codigo: "autogestion.ventana_prorrogada", etiqueta: "Plazo extendido" },
  { codigo: "autogestion.ventana_por_expirar", etiqueta: "Plazo por vencer" },
  { codigo: "autogestion.ventana_expirada", etiqueta: "Plazo vencido" },
  { codigo: "autogestion.actualizacion_aprobada", etiqueta: "Actualización aprobada" },
  { codigo: "autogestion.solicitud_rechazada", etiqueta: "Solicitud rechazada" },
  { codigo: "fe_de_vida.solicitud_recibida", etiqueta: "Fe de vida recibida" },
  { codigo: "fe_de_vida.devuelta", etiqueta: "Fe de vida devuelta" },
  { codigo: "fe_de_vida.validada", etiqueta: "Fe de vida validada" },
  { codigo: "fe_de_vida.rechazada", etiqueta: "Fe de vida rechazada" },
  { codigo: "fe_de_vida.recordatorio_cierre", etiqueta: "Recordatorio de fe de vida" },
  { codigo: "identidad.cuenta_creada", etiqueta: "Cuenta creada" },
  { codigo: "identidad.password_cambiada", etiqueta: "Contraseña cambiada" },
  { codigo: "identidad.correo_acceso_cambiado", etiqueta: "Correo de acceso cambiado" },
];

/** Tipos conocidos por bandeja, para el filtro «Tipo». */
export const TIPOS_POR_MODULO: Record<ModuloNotificaciones, TipoNotificacion[]> = {
  autogestion: AUTOGESTION,
  personal: [
    { codigo: "autogestion.solicitud_creada", etiqueta: "Solicitud por habilitar" },
    { codigo: "autogestion.solicitud_enviada", etiqueta: "Solicitud por revisar" },
    { codigo: "fe_de_vida.solicitud_enviada", etiqueta: "Fe de vida por revisar" },
    { codigo: "fe_de_vida.primer_check", etiqueta: "Fe de vida pendiente de segundo check" },
  ],
  carnetizacion: [{ codigo: "autogestion.foto_aprobada", etiqueta: "Reemisión de carnet" }],
  pasivos: [],
  seguridad: [],
};
