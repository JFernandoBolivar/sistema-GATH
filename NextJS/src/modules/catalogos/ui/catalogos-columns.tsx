"use client";

/**
 * Definición de columnas del listado de un catálogo para `DataTable`
 * (tanstack). Reemplaza la tabla HTML plana anterior: ID, Nombre y una
 * columna de Acciones con menú desplegable (Editar / Eliminar) en vez de
 * botones de ícono sueltos — mismo patrón que `personal-columns.tsx` y el
 * legado (`tableUser`/`tableRole`).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";

import type { CatalogoItemDTO } from "../application/dtos/catalogos-dto";
import type { CodigoCatalogo } from "./schema/schema-catalogos";

function AccionesCell({
  item,
  puedeEditar,
  puedeEliminar,
  onEditar,
  onEliminar,
}: {
  item: CatalogoItemDTO;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  onEditar: (item: CatalogoItemDTO) => void;
  onEliminar: (item: CatalogoItemDTO) => void;
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
        {puedeEditar && (
          <DropdownMenuItem onClick={() => onEditar(item)}>
            <Pencil className="size-4" aria-hidden="true" /> Editar
          </DropdownMenuItem>
        )}
        {puedeEditar && puedeEliminar && <DropdownMenuSeparator />}
        {puedeEliminar && (
          <DropdownMenuItem variant="destructive" onClick={() => onEliminar(item)}>
            <Trash2 className="size-4" aria-hidden="true" /> Eliminar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasCatalogo(
  codigo: CodigoCatalogo,
  puedeEditar: boolean,
  puedeEliminar: boolean,
  onEditar: (item: CatalogoItemDTO) => void,
  onEliminar: (item: CatalogoItemDTO) => void,
): ColumnDef<CatalogoItemDTO>[] {
  const columnas: ColumnDef<CatalogoItemDTO>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span>,
    },
    { accessorKey: "nombre", header: "Nombre" },
  ];

  if (puedeEditar || puedeEliminar) {
    columnas.push({
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          item={row.original}
          puedeEditar={puedeEditar}
          puedeEliminar={puedeEliminar}
          onEditar={onEditar}
          onEliminar={onEliminar}
        />
      ),
    });
  }

  return columnas;
}
