"use client";

/**
 * Definición de columnas del listado de usuarios para `DataTable` (tanstack).
 * Réplica estructural del legado (`gestionar-usuarios/modificar/tableUser/columns.tsx`):
 * cédula ordenable, nombres/apellidos, rol, departamento, estado (badge) y una
 * columna de Acciones con menú desplegable (copiar cédula, bloquear/activar,
 * editar) en vez de botones de ícono sueltos.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, Copy, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";

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

import type { DepartamentoDTO, RolDTO, UsuarioDTO } from "../application/dtos/usuario-dto";

function AccionesCell({
  usuario,
  puedeEditar,
  puedeDesactivar,
  onEditar,
  onCambiarEstado,
}: {
  usuario: UsuarioDTO;
  puedeEditar: boolean;
  puedeDesactivar: boolean;
  onEditar: (usuario: UsuarioDTO) => void;
  onCambiarEstado: (usuario: UsuarioDTO) => void;
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
        <DropdownMenuItem onClick={() => navigator.clipboard.writeText(usuario.cedula)}>
          <Copy className="size-4" aria-hidden="true" /> Copiar cédula
        </DropdownMenuItem>
        {(puedeEditar || puedeDesactivar) && <DropdownMenuSeparator />}
        {puedeEditar && (
          <DropdownMenuItem onClick={() => onEditar(usuario)}>
            <Pencil className="size-4" aria-hidden="true" /> Editar
          </DropdownMenuItem>
        )}
        {puedeDesactivar && (
          <DropdownMenuItem
            variant={usuario.isActive ? "destructive" : "default"}
            onClick={() => onCambiarEstado(usuario)}
          >
            {usuario.isActive ? (
              <RotateCcw className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            {usuario.isActive ? "Bloquear" : "Activar"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function construirColumnasUsuarios(
  departamentos: DepartamentoDTO[],
  roles: RolDTO[],
  puedeEditar: boolean,
  puedeDesactivar: boolean,
  onEditar: (usuario: UsuarioDTO) => void,
  onCambiarEstado: (usuario: UsuarioDTO) => void,
): ColumnDef<UsuarioDTO>[] {
  const nombreDepartamento = (id: number | null) => departamentos.find((d) => d.id === id)?.nombre ?? "—";
  const nombreRol = (id: number | null) => roles.find((r) => r.id === id)?.nombreRol ?? "—";

  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cédula" />,
      cell: ({ row }) => <span className="font-medium">{row.original.cedula}</span>,
    },
    {
      id: "nombre",
      header: "Nombre",
      cell: ({ row }) => `${row.original.nombres} ${row.original.apellidos}`,
    },
    {
      accessorKey: "correo",
      header: "Correo",
      cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
    },
    {
      id: "departamento",
      header: "Departamento",
      cell: ({ row }) => nombreDepartamento(row.original.departamentoId),
    },
    {
      id: "rol",
      header: "Rol",
      cell: ({ row }) => nombreRol(row.original.rolId),
    },
    {
      accessorKey: "isActive",
      header: "Estado",
      cell: ({ getValue }) => (
        <Badge variant={(getValue() as boolean) ? "secondary" : "outline"}>
          {(getValue() as boolean) ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => (
        <AccionesCell
          usuario={row.original}
          puedeEditar={puedeEditar}
          puedeDesactivar={puedeDesactivar}
          onEditar={onEditar}
          onCambiarEstado={onCambiarEstado}
        />
      ),
    },
  ];
}
