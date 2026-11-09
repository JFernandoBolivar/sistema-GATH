/** Nombre visible de cada módulo del catálogo de permisos (agrupación en pantallas). */
const MODULOS: Record<string, string> = {
  identidad: "Identidad y seguridad",
  organizacion: "Organización",
  catalogos: "Catálogos",
  personal: "Personal activo",
  pasivos: "Personal pasivo",
  cargos: "Cargos y ubicaciones",
  familiares: "Familiares y cargas",
  movimientos: "Movimientos e historial",
  reportes: "Reportes y constancias",
  carnetizacion: "Carnetización",
  autogestion: "Autogestión",
  bienestar: "Bienestar Social",
  fe_de_vida: "Fe de vida",
  notificaciones: "Notificaciones",
  auditoria: "Auditoría",
  configuracion: "Configuración",
  puntocuenta: "Punto de cuenta",
};

export function nombreModulo(modulo: string): string {
  return MODULOS[modulo] ?? modulo;
}
