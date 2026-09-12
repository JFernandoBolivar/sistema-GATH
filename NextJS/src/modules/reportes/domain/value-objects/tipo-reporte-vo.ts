/**
 * Value Object tipo de reporte institucional. Evita "string literals"
 * dispersos en las consultas de reportes.
 */
export type TipoReportePersonalVO =
  | "personal-activo"
  | "personal-pasivo"
  | "vacantes"
  | "familiares"
  | "codigos"
  | "tendencias";

const TIPOS: readonly TipoReportePersonalVO[] = [
  "personal-activo",
  "personal-pasivo",
  "vacantes",
  "familiares",
  "codigos",
  "tendencias",
];

export type TipoReportePersonal = (typeof TIPOS)[number];

export function crearTipoReportePersonalVO(valor: string): TipoReportePersonalVO {
  const normalizado = valor.trim().toLowerCase();
  if (!(TIPOS as readonly string[]).includes(normalizado)) {
    throw new Error(`Tipo de reporte inválido: ${valor}`);
  }
  return normalizado as TipoReportePersonalVO;
}
