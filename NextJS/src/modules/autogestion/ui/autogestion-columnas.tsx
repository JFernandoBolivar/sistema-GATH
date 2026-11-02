"use client";

/**
 * Definición de columnas del reporte por dependencias para `DataTable`
 * (tanstack). El legado no fragmenta autogestión en `DataTable`+dropdown —
 * usa una tabla plana con un único botón "Ver" (ver
 * PLAN_RECONSTRUCCION_UI_2026-09-15.md) — pero al no haber acciones por fila
 * en este reporte agregado (solo cifras por dependencia) no aplica un menú
 * desplegable; se usa igualmente `DataTable` en vez de una tabla HTML plana
 * por consistencia visual con el resto de módulos (decisión del coordinador).
 */
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type { ReporteDependenciaDTO } from "../application/dtos/censo-dto";

export function construirColumnasReporteDependencias(): ColumnDef<ReporteDependenciaDTO>[] {
  return [
    {
      accessorKey: "dependencia",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Dependencia" />,
      cell: ({ row }) => <span className="font-medium">{row.original.dependencia}</span>,
    },
    {
      accessorKey: "totalEmpleados",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Total empleados" />,
    },
    {
      accessorKey: "empleadosCensados",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Empleados censados" />,
    },
  ];
}
