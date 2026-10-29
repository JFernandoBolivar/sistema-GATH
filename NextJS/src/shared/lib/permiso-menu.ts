import { tienePermiso } from "@/shared/lib/evaluador-iam";

/**
 * Un ítem de menú sin `permiso` es visible para todos; con `permiso` solo si la
 * sesión lo tiene (R16: permisos por código, nunca nombre de rol/departamento).
 */
export function puedeVerItemMenu(
  permisos: string[] | null | undefined,
  permiso?: string,
): boolean {
  return !permiso || tienePermiso(permisos, permiso);
}

/** Filtra ítems de menú (y sus submenús); un grupo sin hijos visibles se oculta. */
export function filtrarMenuPorPermisos<
  T extends { permiso?: string; subMenu?: S[] },
  S extends { permiso?: string },
>(items: T[], permisos: string[] | null | undefined): T[] {
  return items
    .filter((item) => puedeVerItemMenu(permisos, item.permiso))
    .map((item) =>
      item.subMenu
        ? { ...item, subMenu: item.subMenu.filter((s) => puedeVerItemMenu(permisos, s.permiso)) }
        : item,
    )
    .filter((item) => !item.subMenu || item.subMenu.length > 0);
}
