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
export function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div>{value ?? "N/A"}</div>
    </div>
  );
}
