import {
  cumpleCondicion,
  tienePermiso,
  type CondicionTrabajador,
} from "@/shared/lib/evaluador-iam";

/**
 * Un ítem puede exigir además una `condicion` (ACTIVO/PASIVO) del trabajador, dato derivado
 * en servidor (no es un rol): fe de vida = `fe_de_vida.solicitar` + PASIVO; censo y carnet =
 * ACTIVO. El backend la vuelve a validar (`RequiereCondicion`).
 *
 * Un ítem de menú sin `permiso` es visible para todos; con `permiso` solo si la
 * sesión lo tiene (R16: permisos por código, nunca nombre de rol/departamento).
 */
export function puedeVerItemMenu(
  permisos: string[] | null | undefined,
  permiso?: string,
  condicionRequerida?: CondicionTrabajador,
  condicionTrabajador?: string | null,
): boolean {
  if (permiso && !tienePermiso(permisos, permiso)) return false;
  return cumpleCondicion(condicionRequerida, condicionTrabajador);
}

/** Filtra ítems de menú (y sus submenús); un grupo sin hijos visibles se oculta. */
export function filtrarMenuPorPermisos<
  T extends { permiso?: string; condicion?: CondicionTrabajador; subMenu?: S[] },
  S extends { permiso?: string; condicion?: CondicionTrabajador },
>(items: T[], permisos: string[] | null | undefined, condicionTrabajador?: string | null): T[] {
  return items
    .filter((item) => puedeVerItemMenu(permisos, item.permiso, item.condicion, condicionTrabajador))
    .map((item) =>
      item.subMenu
        ? {
            ...item,
            subMenu: item.subMenu.filter((s) =>
              puedeVerItemMenu(permisos, s.permiso, s.condicion, condicionTrabajador),
            ),
          }
        : item,
    )
    .filter((item) => !item.subMenu || item.subMenu.length > 0);
}
