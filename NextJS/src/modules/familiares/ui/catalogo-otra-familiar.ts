/**
 * Opción "Otra" de los catálogos académicos del mini-expediente del familiar
 * (paridad con el legado): valor sentinela del select que revela un input
 * para escribir el nombre nuevo. El alta real la hace
 * `resolverAltasInlineFamiliarAction` antes de guardar.
 */
export const ID_OTRA_FAMILIAR = -1;

/** El legado no ofrece "Otra carrera" cuando el nivel es "No posee" / "N/P". */
export function esNivelNoPoseeFamiliar(nombreNivel: string | undefined) {
  const n = nombreNivel?.toLowerCase() ?? "";
  return n.includes("no posee") || n === "n/p";
}
