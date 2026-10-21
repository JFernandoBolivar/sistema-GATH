/**
 * Fila de etiqueta/valor en grid de 2 columnas, para paneles de detalle de
 * solo lectura (Sheets de expediente). Extraído de `FilaInfo`
 * (`modules/personal/ui/empleado-detalle-sheet.tsx`) e `InfoRow` inline
 * (`modules/pasivos/ui/detalle-pasivo.tsx`, `modules/familiares/ui/
 * detalle-familiar.tsx`), que reimplementaban el mismo bloque
 * `<div className="text-muted-foreground">...</div><div>...</div>` decenas
 * de veces cada uno (ponytail-audit, AUDITORIA_CALIDAD_FRONTEND_2026-09-15.md
 * §8.1/§8.2 punto 9). Componente puro de `shared/ui/`, sin lógica de negocio.
 */
import type React from "react";

function esValorVacio(val: React.ReactNode): boolean {
  if (val === null || val === undefined || val === "") return true;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    return s === "" || s === "nan" || s === "none" || s === "null" || s === "undefined";
  }
  return false;
}

export function InfoRow({
  label,
  value,
  className,
  emptyText = "No posee",
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
  emptyText?: string;
}) {
  const displayValue = esValorVacio(value) ? emptyText : value;

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-4 py-2 text-sm md:text-base items-baseline ${
        className || ""
      }`}
    >
      <div className="text-muted-foreground font-medium text-sm md:text-base">{label}</div>
      <div className="font-semibold text-foreground break-words text-sm md:text-base">
        {displayValue}
      </div>
    </div>
  );
}
