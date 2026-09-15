"use client";

/**
 * Definición de columnas del listado de cargas familiares para `DataTable`
 * (tanstack). Réplica de paridad estructural con el legado
 * (`tableFamilys/columns.tsx`): cédula, primer nombre/apellido, parentesco,
 * fecha de nacimiento, heredero (badge) y una columna de acciones con menú
 * desplegable (copiar cédula, ver detalle) en vez de botones sueltos. El
 * legado no mostraba "eliminar" en este menú; se agrega aquí porque
 * `familiares.eliminar` sí es una capacidad real y ya implementada del
 * backend nuevo (a diferencia de estado civil/formación/salud, que se
 * documentó como brecha nunca funcional — ver `detalle-familiar.tsx`).
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, Eye, MoreHorizontal, Trash2 } from "lucide-react";

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

import type { FamiliarDTO } from "../application/dtos/familiar-dto";
import { fechaLegible } from "./detalle-familiar-view-model";

function AccionesCell({ familiar, puedeEliminar, onVerDetalle, onEliminar }: {
  familiar: FamiliarDTO;
  puedeEliminar: boolean;
  onVerDetalle: (familiar: FamiliarDTO) => void;
  onEliminar: (familiar: FamiliarDTO) => void;
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
        <DropdownMenuItem
          onClick={() => navigator.clipboard.writeText(familiar.cedulaFamiliar ?? "")}
          disabled={!familiar.cedulaFamiliar}
        >
          <Copy className="size-4" aria-hidden="true" /> Copiar cédula
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onVerDetalle(familiar)}>
          <Eye className="size-4" aria-hidden="true" /> Ver detalle
        </DropdownMenuItem>
        {puedeEliminar && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onEliminar(familiar)}
            >
              <Trash2 className="size-4" aria-hidden="true" /> Eliminar
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasFamiliares(
  puedeEliminar: boolean,
  onVerDetalle: (familiar: FamiliarDTO) => void,
  onEliminar: (familiar: FamiliarDTO) => void,
): ColumnDef<FamiliarDTO>[] {
  return [
    {
      accessorKey: "cedulaFamiliar",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as string | null) ?? "—"}</span>,
    },
    { accessorKey: "primerNombre", header: "Primer nombre" },
    { accessorKey: "primerApellido", header: "Primer apellido" },
    {
      accessorKey: "parentescoNombre",
      header: "Parentesco",
      cell: ({ getValue }) => <Badge variant="secondary">{getValue() as string}</Badge>,
    },
    {
      accessorKey: "fechaNacimiento",
      header: "F. Nacimiento",
      cell: ({ getValue }) => <span>{fechaLegible(getValue() as string)}</span>,
    },
    {
      accessorKey: "heredero",
      header: "Heredero",
      cell: ({ getValue }) => (
        <Badge variant={(getValue() as boolean) ? "default" : "destructive"}>
          {(getValue() as boolean) ? "Heredero" : "No heredero"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          familiar={row.original}
          puedeEliminar={puedeEliminar}
          onVerDetalle={onVerDetalle}
          onEliminar={onEliminar}
        />
      ),
    },
  ];
}
