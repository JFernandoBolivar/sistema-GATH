import { tienePermiso } from "@/shared/lib/evaluador-iam";

/**
 * Perfiles de navegación derivados de permisos por código (R16), no del
 * nombre del rol. Los códigos son los que existen en BD (ver PERMISOS.md):
 *
 * - Autogestión: tiene permisos de censo propio y NO ve personal.
 * - Recepcionista (solo consulta): ve personal pero no crea ni accede a
 *   reportes. Presupuesto y Bienestar Social también ven personal sin
 *   crear, pero tienen `reportes.ver`, por eso no caen en este perfil.
 */
export function esPerfilAutogestion(permisos: string[] | null | undefined): boolean {
  return (
    (tienePermiso(permisos, "autogestion.censo_ver_propio") ||
      tienePermiso(permisos, "autogestion.ver_propio")) &&
    !tienePermiso(permisos, "personal.ver")
  );
}

export function esPerfilRecepcionista(permisos: string[] | null | undefined): boolean {
  return (
    tienePermiso(permisos, "personal.ver") &&
    !tienePermiso(permisos, "personal.crear") &&
    !tienePermiso(permisos, "reportes.ver")
  );
}
