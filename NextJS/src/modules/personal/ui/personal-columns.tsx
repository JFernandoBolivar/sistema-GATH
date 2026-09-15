"use client";

/**
 * Definición de columnas del listado de personal para `DataTable`
 * (tanstack). Réplica de paridad estructural con el legado
 * (`tableEmployees/columns.tsx`): cédula ordenable, nombres/apellidos,
 * sexo, fecha de nacimiento, correo, APN y una columna de acciones con
 * menú desplegable (copiar cédula, ver detalle) en vez de botones sueltos.
 *
 * Nota de alcance: el legado también mostraba "Estatus Contrato" (badge de
 * color) y "F. Ingreso Organismo" en esta misma tabla porque el listado
 * legado (`EmployeeData`) traía el expediente completo anidado en cada
 * fila. El listado nuevo (`GET /api/v1/personal/`) solo puebla ese
 * expediente en el detalle, no en la lista (`EmpleadoSerializer`, Fase
 * 2.2) — añadir esas dos columnas requeriría cambiar el contrato del
 * backend, fuera del alcance de este ajuste de capa `ui/`.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Camera, Copy, Eye, MoreHorizontal } from "lucide-react";

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

function AccionesCell({ empleado, puedeVerDetalle, puedeEditar, onVerDetalle, onSubirFoto }: {
  empleado: EmpleadoDTO;
  puedeVerDetalle: boolean;
  puedeEditar: boolean;
  onVerDetalle: (cedula: string) => void;
  onSubirFoto: (cedula: string) => void;
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(empleado.cedula)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar cédula
        </DropdownMenuItem>
        {puedeVerDetalle && (
          <DropdownMenuItem onClick={() => onVerDetalle(empleado.cedula)}>
            <Eye className="size-4" aria-hidden="true" /> Ver detalle
          </DropdownMenuItem>
        )}
        {puedeEditar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSubirFoto(empleado.cedula)}>
              <Camera className="size-4" aria-hidden="true" /> Subir foto
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasPersonal(
  puedeVerDetalle: boolean,
  puedeEditar: boolean,
  onVerDetalle: (cedula: string) => void,
  onSubirFoto: (cedula: string) => void,
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
      cell: ({ getValue }) => <span>{(getValue() as string | null) ?? "N/A"}</span>,
    },
    {
      accessorKey: "correo",
      header: "Correo",
      cell: ({ getValue }) => <span>{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      accessorKey: "totalAnosApn",
      header: "APN",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          empleado={row.original}
          puedeVerDetalle={puedeVerDetalle}
          puedeEditar={puedeEditar}
          onVerDetalle={onVerDetalle}
          onSubirFoto={onSubirFoto}
        />
      ),
    },
  ];
}
