"use client";

/**
 * Definición de columnas del listado de cargos para `DataTable` (tanstack).
 * Réplica de paridad estructural con el legado (`listado-codigo/tableCodeInfo/columns.tsx`):
 * código ordenable, denominación/específica/grado/nómina, ubicación
 * administrativa, badge de estatus con los mismos colores del legado, y una
 * columna de acciones con menú desplegable (copiar código, ver detalle) en
 * vez de botones sueltos.
 *
 * Nota de alcance: el legado mostraba la ubicación (D/G/O, División,
 * Coordinación) con un HoverCard ("Mostrar" -> tooltip); aquí se muestra
 * directamente como texto de columna, una simplificación visual menor que
 * no cambia la información disponible.
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

import type { CargoAsignacionDTO } from "../application/dtos/cargo-dto";

function EstatusBadge({ estatusNombre, estaVacante }: { estatusNombre: string; estaVacante: boolean }) {
  if (estaVacante) return <Badge className="bg-green-700 text-white hover:bg-green-700">{estatusNombre}</Badge>;
  if (estatusNombre === "ACTIVO") return <Badge className="bg-[#ffc523] text-black hover:bg-[#ffc523]">{estatusNombre}</Badge>;
  if (estatusNombre === "SUSPENDIDO") return <Badge className="bg-gray-500 text-white hover:bg-gray-500">{estatusNombre}</Badge>;
  return <Badge variant="destructive">{estatusNombre}</Badge>;
}

function AccionesCell({ cargo, puedeVerDetalle, onVerDetalle }: {
  cargo: CargoAsignacionDTO;
  puedeVerDetalle: boolean;
  onVerDetalle: (cargoId: number) => void;
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(cargo.codigo)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar código
        </DropdownMenuItem>
        {puedeVerDetalle && (
          <DropdownMenuItem onClick={() => onVerDetalle(cargo.id)}>
            <Eye className="size-4" aria-hidden="true" /> Ver detalle
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasCargos(
  puedeVerDetalle: boolean,
  onVerDetalle: (cargoId: number) => void,
): ColumnDef<CargoAsignacionDTO>[] {
  return [
    {
      accessorKey: "codigo",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Código" />,
      cell: ({ row }) => <span className="font-medium">{row.original.codigo}</span>,
    },
    { accessorKey: "denominacionNombre", header: "D. Cargo" },
    { accessorKey: "especificaNombre", header: "D. Cargo Específico" },
    {
      accessorKey: "tipoNominaNombre",
      header: "Nómina",
    },
    {
      accessorKey: "empleadoCedula",
      header: "Empleado",
      cell: ({ getValue }) => <span>{(getValue() as string | null) ?? "Vacante"}</span>,
    },
    {
      id: "ubicacion",
      header: "Ubicación",
      cell: ({ row }) => {
        const c = row.original;
        const partes = [c.coordinacionNombre, c.direccionLineaNombre, c.direccionGeneralNombre, c.dependenciaNombre].filter(Boolean);
        return <span className="text-sm text-muted-foreground">{partes[0] ?? "—"}</span>;
      },
    },
    {
      accessorKey: "estatusNombre",
      header: "Estatus",
      cell: ({ row }) => <EstatusBadge estatusNombre={row.original.estatusNombre} estaVacante={row.original.estaVacante} />,
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell cargo={row.original} puedeVerDetalle={puedeVerDetalle} onVerDetalle={onVerDetalle} />
      ),
    },
  ];
}
