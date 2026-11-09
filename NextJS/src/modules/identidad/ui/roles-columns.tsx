"use client";

/**
 * Definición de columnas del listado de roles para `DataTable` (tanstack).
 * Réplica estructural del legado (`gestionar-roles/tableRole/columns.tsx`):
 * ID, nombre y una columna de Acciones con menú desplegable (copiar nombre,
 * editar, eliminar).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";

import type { RolDTO } from "../application/dtos/usuario-dto";

function AccionesCell({
  rol,
  puedeEditar,
  puedeEliminar,
  onEditar,
  onEliminar,
}: {
  rol: RolDTO;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  onEditar: (rol: RolDTO) => void;
  onEliminar: (rol: RolDTO) => void;
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(rol.nombreVisible)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar nombre
        </DropdownMenuItem>
        {(puedeEditar || puedeEliminar) && <DropdownMenuSeparator />}
        {puedeEditar && (
          <DropdownMenuItem onClick={() => onEditar(rol)}>
            <Pencil className="size-4" aria-hidden="true" /> Editar
          </DropdownMenuItem>
        )}
        {puedeEliminar && (
          <DropdownMenuItem variant="destructive" onClick={() => onEliminar(rol)}>
            <Trash2 className="size-4" aria-hidden="true" /> Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasRoles(
  puedeEditar: boolean,
  puedeEliminar: boolean,
  onEditar: (rol: RolDTO) => void,
  onEliminar: (rol: RolDTO) => void,
): ColumnDef<RolDTO>[] {
  return [
    { accessorKey: "nombreVisible", header: "Nombre" },
    {
      accessorKey: "nombreRol",
      header: "Código",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "descripcionRol",
      header: "Descripción",
      cell: ({ getValue }) => (getValue() as string) || "—",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          rol={row.original}
          puedeEditar={puedeEditar}
          puedeEliminar={puedeEliminar}
          onEditar={onEditar}
          onEliminar={onEliminar}
        />
      ),
    },
  ];
}
