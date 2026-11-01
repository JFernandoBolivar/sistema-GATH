"use client";

/**
 * Definición de columnas del historial de movimientos para `DataTable` (tanstack).
 * 100% paridad con el sistema de referencia:
 * `dashboard/gestion-trabajadores/components/movimientos/tableMoves/columns.tsx`.
 *
 * Exactamente 7 columnas:
 * 1. Código Puesto (sortable)
 * 2. Fecha Movimiento (UTC dd/MM/yyyy, sortable)
 * 3. Tipo de Movimiento (badge temático)
 * 4. Nuevo Cargo (cargo específico o denominación)
 * 5. Nuevo Grado
 * 6. Modificado Por (nombre del usuario/analista)
 * 7. Acciones (Copiar Código Puesto, Ver detalles)
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Eye, MoreHorizontal } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";

import type { MovimientoCargoDTO } from "../application/dtos/movimientos-dto";

export function TipoMovimientoBadge({ tipo }: { tipo: string | null | undefined }) {
  if (!tipo) return <span className="text-muted-foreground">N/A</span>;

  const normalizado = tipo.trim().toUpperCase();
  if (normalizado.includes("ASCENSO")) {
    return (
      <Badge className="border-success/40 bg-success-soft text-success hover:bg-success-soft dark:border-success/40 dark:bg-success-soft dark:text-success">
        {tipo}
      </Badge>
    );
  }
  if (normalizado.includes("TRANSFERENCIA") || normalizado.includes("TRASLADO")) {
    return (
      <Badge className="border-primary/40 bg-info-soft text-primary hover:bg-info-soft dark:border-primary/40 dark:bg-info-soft dark:text-primary">
        {tipo}
      </Badge>
    );
  }
  if (normalizado.includes("HORIZONTAL")) {
    return (
      <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
        {tipo}
      </Badge>
    );
  }
  if (normalizado.includes("REASIGNACI") || normalizado.includes("ASIGNACION")) {
    return (
      <Badge className="border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
        {tipo}
      </Badge>
    );
  }
  if (normalizado.includes("ESPECIAL")) {
    return (
      <Badge className="border-warning/40 bg-warning-soft text-warning hover:bg-warning-soft dark:border-warning/40 dark:bg-warning-soft dark:text-warning">
        {tipo}
      </Badge>
    );
  }
  if (normalizado.includes("PRÉSTAMO") || normalizado.includes("PRESTAMO")) {
    return (
      <Badge className="border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
        {tipo}
      </Badge>
    );
  }
  if (normalizado.includes("EGRESO") || normalizado.includes("PASIVO") || normalizado.includes("DESINCORPORACI")) {
    return (
      <Badge className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
        {tipo}
      </Badge>
    );
  }

  return <Badge variant="secondary">{tipo}</Badge>;
}

function formatFechaMov(fecha: string | null | undefined): string {
  if (!fecha) return "N/A";
  try {
    return formatInTimeZone(new Date(fecha), "UTC", "dd/MM/yyyy");
  } catch {
    return fecha;
  }
}

function AccionesCell({
  movimiento,
  puedeVer = true,
  onVerDetalle,
}: {
  movimiento: MovimientoCargoDTO;
  puedeVer?: boolean;
  onVerDetalle: (movimiento: MovimientoCargoDTO) => void;
}) {
  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(movimiento.codigoPuesto);
      toast.success("Código de puesto copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0 cursor-pointer">
          <span className="sr-only">Abrir menú</span>
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={copiarCodigo} className="cursor-pointer">
          <Copy className="size-4 mr-2" aria-hidden="true" /> Copiar Código Puesto
        </DropdownMenuItem>
        {puedeVer && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Detalles</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onVerDetalle(movimiento)} className="cursor-pointer">
              <Eye className="size-4 mr-2" aria-hidden="true" /> Ver detalles
            </DropdownMenuItem>
          </>
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
      accessorKey: "codigoPuesto",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código Puesto" />,
      cell: ({ getValue }) => {
        const val = getValue() as string | null | undefined;
        return val ? <span className="font-mono text-xs">{val}</span> : <span className="text-muted-foreground">N/A</span>;
      },
    },
    {
      accessorKey: "fechaMovimiento",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha Movimiento" />,
      cell: ({ getValue }) => {
        const val = getValue() as string | null | undefined;
        return <span>{formatFechaMov(val)}</span>;
      },
    },
    {
      accessorKey: "tipoMovimiento",
      header: "Tipo de Movimiento",
      cell: ({ row }) => {
        const motivo = row.original.motivoNombre || row.original.tipoMovimiento;
        return <TipoMovimientoBadge tipo={motivo} />;
      },
    },
    {
      accessorKey: "especificaNombre",
      header: "Nuevo Cargo",
      cell: ({ row }) => {
        const cargo = row.original.especificaNombre || row.original.denominacionNombre || "N/A";
        return <span>{cargo}</span>;
      },
    },
    {
      accessorKey: "gradoNombre",
      header: "Nuevo Grado",
      cell: ({ getValue }) => {
        const val = getValue() as string | null | undefined;
        return <span>{val || "N/A"}</span>;
      },
    },
    {
      accessorKey: "ejecutadoPorNombre",
      header: "Modificado Por",
      cell: ({ getValue }) => {
        const val = getValue() as string | null | undefined;
        return <span>{val || "N/A"}</span>;
      },
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
