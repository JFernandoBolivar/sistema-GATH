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
  ],
  carnetizacion: [{ codigo: "autogestion.foto_aprobada", etiqueta: "Reemisión de carnet" }],
  pasivos: [],
  seguridad: [],
};
