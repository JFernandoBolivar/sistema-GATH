/**
 * Opción "Otra" de los catálogos académicos (paridad con el legado): valor
 * sentinela del select que revela un input para escribir el nombre nuevo.
 * El alta real la hace `resolverAltasInlineAction` antes de guardar.
 */
export const ID_OTRA = -1;
export const OPCION_OTRA = { value: String(ID_OTRA), label: "Otra" };

/** El legado no ofrece "Otra carrera" cuando el nivel es "No posee" / "N/P". */
export function esNivelNoPosee(nombreNivel: string | undefined) {
  const n = nombreNivel?.toLowerCase() ?? "";
  return n.includes("no posee") || n === "n/p";
}
