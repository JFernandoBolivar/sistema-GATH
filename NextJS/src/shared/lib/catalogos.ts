/**
 * Resolución de nombre de catálogo por ID, compartida entre paneles de
 * detalle que reciben un expediente con IDs sueltos (`_id`) y necesitan
 * mostrarlos como texto legible. Antes duplicado como `nombrePorId`
 * (`modules/personal/ui/expediente-detalle-view-model.ts`) y
 * `nombreCatalogo` (`modules/pasivos/ui/detalle-pasivo.tsx`), con la misma
 * lógica (ponytail-audit, AUDITORIA_CALIDAD_FRONTEND_2026-09-15.md §8.1
 * punto 3).
 *
 * Si el catálogo no contiene el ID referenciado, se devuelve `ID <n>` en
 * vez de un "N/A" silencioso: es una señal real de que el catálogo cargado
 * no coincide con el expediente (comportamiento ya probado en
 * `expediente-detalle-view-model.test.ts`), preferible a esconder un fallo
 * de resolución de datos.
 */
const SIN_DATO = "N/A";

export interface CatalogoItem {
  id: number;
  nombre: string;
}

export function nombrePorId(lista: CatalogoItem[] | undefined, id: number | null | undefined): string {
  if (id === null || id === undefined) return SIN_DATO;
  return lista?.find((x) => x.id === id)?.nombre ?? `ID ${id}`;
}

export function nombresPorIds(lista: CatalogoItem[] | undefined, ids: number[] | undefined): string[] {
  return (ids ?? []).map((id) => nombrePorId(lista, id));
}
