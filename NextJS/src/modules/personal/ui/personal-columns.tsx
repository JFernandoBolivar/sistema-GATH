"use client";

/**
 * Definición de columnas del listado de personal para `DataTable` (tanstack).
 * 100% Paridad visual y estructural con el sistema de referencia
 * (`tableEmployees/columns.tsx`):
 * - Cédula (ordenable con DataTableColumnHeader)
 * - Nombres
 * - Apellidos
 * - Sexo (primera letra M/F)
 * - F. Nacimiento (dd/MM/yyyy)
 * - Estatus Contrato (Badge verde ACTIVO / amarillo POR VENCER / rojo VENCIDO o N/A)
 * - F. Ingreso Organismo (fecha de ingreso del contrato o N/A)
 * - Menú de acciones:
 *   - Acciones: "Copiar Cédula De Identidad"
 *   - Extras: "Expediente PDF" (ExportButton) y botón azul "Ver Detalles"
 */
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

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

import type { EmpleadoDTO } from "../application/dtos/empleado-dto";

function AccionesCell({
  empleado,
  puedeExportarPdf,
  onVerDetalle,
  onExportarPdfDirecto,
}: {
  empleado: EmpleadoDTO;
  puedeExportarPdf: boolean;
  onVerDetalle: (cedula: string) => void;
  onExportarPdfDirecto?: (cedula: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Abrir Menu</span>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => navigator.clipboard.writeText(empleado.cedula)}
        >
          Copiar Cédula De Identidad
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Extras</DropdownMenuLabel>
        {puedeExportarPdf && (
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onExportarPdfDirecto?.(empleado.cedula)}
          >
            Expediente PDF
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Button
            type="button"
            className="w-full bg-blue-900 hover:bg-blue-800 p-2 rounded-sm text-white font-medium cursor-pointer"
            onClick={() => onVerDetalle(empleado.cedula)}
          >
            Ver Detalles
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasPersonal(
  puedeVerDetalle: boolean,
  puedeEditar: boolean,
  onVerDetalle: (cedula: string) => void,
  onSubirFoto: (cedula: string) => void,
  puedeExportarPdf: boolean = false,
  onExportarPdfDirecto?: (cedula: string) => void,
): ColumnDef<EmpleadoDTO>[] {
  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ row }) => <span className="font-medium">{row.original.cedula}</span>,
    },
    { accessorKey: "nombres", header: "Nombres" },
    { accessorKey: "apellidos", header: "Apellidos" },
    {
      accessorKey: "sexoNombre",
      header: "Sexo",
      cell: ({ getValue }) => <span>{(getValue() as string)?.[0] ?? "N/A"}</span>,
    },
    {
      accessorKey: "fechaNacimiento",
      header: "F. Nacimiento",
      cell: ({ getValue }) => {
        const val = getValue() as string | null;
        if (!val) return <span>N/A</span>;
        // Normalizar a dd/MM/yyyy
        const parts = val.split("-");
        if (parts.length === 3) {
          return <span>{`${parts[2]}/${parts[1]}/${parts[0]}`}</span>;
        }
        return <span>{val}</span>;
      },
    },
    {
      id: "estatus_contrato",
      header: "Estatus Contrato",
      cell: ({ row }) => {
        const estatus = row.original.contratoActual?.estatusNombre?.toUpperCase();
        if (!estatus) return <span>N/A</span>;
        const color =
          estatus === "ACTIVO"
            ? "bg-green-600"
            : estatus === "POR VENCER"
            ? "bg-yellow-500"
            : "bg-red-600";
        return <Badge className={`${color} text-white`}>{estatus}</Badge>;
      },
    },
    {
      id: "fecha_ingreso_org",
      header: "F. Ingreso Organismo",
      cell: ({ row }) => {
        const fecha = row.original.contratoActual?.fechaIngreso;
        if (!fecha) return <span>N/A</span>;
        const parts = fecha.split("-");
        if (parts.length === 3) {
          return <span>{`${parts[2]}/${parts[1]}/${parts[0]}`}</span>;
        }
        return <span>{fecha}</span>;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          empleado={row.original}
          puedeExportarPdf={puedeExportarPdf}
          onVerDetalle={onVerDetalle}
          onExportarPdfDirecto={onExportarPdfDirecto}
        />
      ),
    },
  ];
}
