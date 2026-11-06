/**
 * Formato legible del tiempo de servicio en APN (años fraccionarios →
 * «4 años y 6 meses de servicio en APN»). Sin decimales largos.
 *
 * Vive en `shared` porque lo usan Autogestión (Mi ficha) y Reportes; el módulo
 * de Autogestión lo reexporta para no romper sus importaciones.
 */
export function formatearTiempoServicio(anos: number | null | undefined): string {
  if (anos == null || Number.isNaN(anos) || anos <= 0) {
    return "0 días de servicio en APN";
  }

  if (anos < 1) {
    const totalDias = Math.round(anos * 365);
    if (totalDias < 30) {
      const dias = Math.max(1, totalDias);
      return `${dias} ${dias === 1 ? "día" : "días"} de servicio en APN`;
    }
    const meses = Math.floor(totalDias / 30.4375);
    const diasRestantes = Math.round(totalDias % 30.4375);
    if (diasRestantes === 0 || meses >= 12) {
      const m = Math.min(11, Math.max(1, meses));
      return `${m} ${m === 1 ? "mes" : "meses"} de servicio en APN`;
    }
    return `${meses} ${meses === 1 ? "mes" : "meses"} y ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de servicio en APN`;
  }

  const aniosEnteros = Math.floor(anos);
  const mesesFraccion = Math.round((anos - aniosEnteros) * 12);

  if (mesesFraccion === 0) {
    return `${aniosEnteros} ${aniosEnteros === 1 ? "año" : "años"} de servicio en APN`;
  }
  if (mesesFraccion >= 12) {
    return `${aniosEnteros + 1} años de servicio en APN`;
  }
  return `${aniosEnteros} ${aniosEnteros === 1 ? "año" : "años"} y ${mesesFraccion} ${mesesFraccion === 1 ? "mes" : "meses"} de servicio en APN`;
}
