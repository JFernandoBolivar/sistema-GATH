/** Serialización con claves ordenadas: dos objetos con el mismo contenido dan la misma cadena. */
export function firmaEstable(valor: unknown): string {
  return JSON.stringify(ordenar(valor));
}

function ordenar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.keys(o)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        if (o[k] !== undefined) acc[k] = ordenar(o[k]);
        return acc;
      }, {});
  }
  return v;
}

/** `true` si el borrador local difiere del último estado guardado o cargado. */
export function hayCambiosSinGuardar(actual: unknown, base: unknown): boolean {
  if (base == null) return false;
  return firmaEstable(actual) !== firmaEstable(base);
}
