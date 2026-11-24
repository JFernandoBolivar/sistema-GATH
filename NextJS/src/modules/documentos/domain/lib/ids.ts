/**
 * Identificador nuevo, determinista y sin colisiones: `prefijo` + el mayor número
 * usado entre los existentes + 1 (el backend exige ids únicos por definición).
 */
export function generarId(prefijo: string, existentes: Iterable<string>): string {
  let max = 0;
  const re = new RegExp(`^${prefijo}(\\d+)$`);
  for (const id of existentes) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  const usados = new Set(existentes);
  while (usados.has(`${prefijo}${n}`)) n += 1;
  return `${prefijo}${n}`;
}
