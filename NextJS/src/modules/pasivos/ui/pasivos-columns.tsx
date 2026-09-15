"use client";

/**
 * Definición de columnas del listado de pasivos para `DataTable` (tanstack).
 * Réplica de paridad estructural con el legado (`tablePasive/columns.tsx`):
 * cédula, nombre completo, tipo, fecha de egreso, resolución, y una columna
 * de acciones con menú desplegable (copiar cédula, ver detalle) en vez de
 * un botón "Ver detalle" suelto por fila. La exportación a PDF del legado
 * vivía en este mismo menú ("Extras"); aquí vive dentro del Sheet de
 * detalle (`detalle-pasivo.tsx`), mismo criterio ya usado en `modules/personal`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Eye, MoreHorizontal } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type { PasivoDTO } from "../application/dtos/pasivos-dto";

function AccionesCell({ pasivo, onVerDetalle }: {
  pasivo: PasivoDTO;
  onVerDetalle: (cedula: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(pasivo.cedula)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar cédula
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onVerDetalle(pasivo.cedula)}>
          <Eye className="size-4" aria-hidden="true" /> Ver detalle
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasPasivos(
  onVerDetalle: (cedula: string) => void,
): ColumnDef<PasivoDTO>[] {
  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      id: "nombreCompleto",
      accessorFn: (row) => `${row.nombres} ${row.apellidos}`,
      header: "Nombre completo",
    },
    {
      accessorKey: "tipoPasivo",
      header: "Tipo",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    {
      accessorKey: "fechaEgreso",
      header: "Fecha de egreso",
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      accessorKey: "resolucion",
      header: "Resolución",
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <AccionesCell pasivo={row.original} onVerDetalle={onVerDetalle} />,
    },
  ];
}
