"use client";

/**
 * Definición de columnas del historial de movimientos para `DataTable`
 * (tanstack). Réplica de paridad estructural con el legado
 * (`tableMoves/columns.tsx`): código de puesto, fecha, tipo de movimiento,
 * denominación/específica del cargo, motivo, estatus, ejecutado por, y una
 * columna de acciones con menú desplegable (copiar código de puesto, ver
 * detalle) en vez de un botón "Ver detalles" suelto por fila.
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

import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";

function AccionesCell({
  movimiento,
  puedeVer = true,
  onVerDetalle,
}: {
  movimiento: MovimientoCargoDTO;
  puedeVer?: boolean;
  onVerDetalle: (movimiento: MovimientoCargoDTO) => void;
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(movimiento.codigoPuesto)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar código de puesto
        </DropdownMenuItem>
        {puedeVer && (
          <DropdownMenuItem onClick={() => onVerDetalle(movimiento)}>
            <Eye className="size-4" aria-hidden="true" /> Ver detalle
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasMovimientos(
  onVerDetalle: (movimiento: MovimientoCargoDTO) => void,
  puedeVer: boolean = true,
): ColumnDef<MovimientoCargoDTO>[] {
  return [
    {
      accessorKey: "fechaMovimiento",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
      cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "codigoPuesto",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código puesto" />,
    },
    { accessorKey: "empleadoCedula", header: "Cédula" },
    {
      accessorKey: "tipoMovimiento",
      header: "Tipo",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    { accessorKey: "denominacionNombre", header: "Denominación" },
    { accessorKey: "especificaNombre", header: "Específica" },
    {
      accessorKey: "motivoNombre",
      header: "Motivo",
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
    },
    { accessorKey: "estatusNombre", header: "Estatus" },
    {
      accessorKey: "ejecutadoPorNombre",
      header: "Ejecutado por",
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span>,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          movimiento={row.original}
          puedeVer={puedeVer}
          onVerDetalle={onVerDetalle}
        />
      ),
    },
  ];
}
