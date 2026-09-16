/**
 * Formateo de fecha único para toda la capa `ui/`. Antes de este archivo
 * había 3 implementaciones distintas para el mismo resultado (`dd/MM/yyyy`
 * en zona horaria UTC, locale `es-VE`): `date-fns-tz` (`formatInTimeZone`)
 * en `modules/personal`, `Date.prototype.toLocaleDateString` sin zona
 * horaria explícita en `modules/pasivos` (riesgo real de desplazamiento de
 * día según la zona horaria del proceso/navegador), e `Intl.DateTimeFormat`
 * en `modules/familiares` (ponytail-audit,
 * AUDITORIA_CALIDAD_FRONTEND_2026-09-15.md §8.1/§8.2 puntos 7 y 9). Se
 * consolidan aquí con `Intl.DateTimeFormat` nativo — sin dependencia
 * externa — fijando `timeZone: "UTC"` explícitamente (la fuente de la
 * discrepancia entre backend y frontend en fechas sin hora).
 */
const FORMATO_FECHA_VE = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Formatea una fecha ISO a `dd/MM/yyyy` (UTC, locale `es-VE`).
 * - Ausente (`null`/`undefined`/cadena vacía): devuelve `valorPorDefecto`.
 * - Presente pero no parseable: devuelve el valor original tal cual (no se
 *   fabrica un "N/A" que oculte un dato realmente inválido del backend).
 */
export function formatearFecha(fecha: string | null | undefined, valorPorDefecto = "N/A"): string {
  if (!fecha) return valorPorDefecto;
  const parsed = new Date(fecha);
  if (Number.isNaN(parsed.getTime())) return fecha;
  return FORMATO_FECHA_VE.format(parsed);
}
