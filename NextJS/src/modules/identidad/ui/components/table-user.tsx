"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ColumnDef, Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable } from "@/shared/ui/components/data-table";
import { DataTableColumnHeader } from "@/shared/ui/components/data-table-column-header";
import type { DepartamentoDTO, RolDTO, UsuarioDTO } from "../../application/dtos/usuario-dto";
import { cambiarEstadoUsuarioAction } from "../../infrastructure/actions/usuario-actions";
import DetailInfoUser from "./detail-info-user";

function UserActionsCell({
  row,
  onRefresh,
}: {
  row: Row<UsuarioDTO>;
  onRefresh: () => void;
}) {
  const user = row.original;
  const [openEdit, setOpenEdit] = useState(false);

  const handleToggleActive = async () => {
    try {
      const response = await cambiarEstadoUsuarioAction(user.id, !user.isActive);
      if (response && typeof response === "object" && "error" in response) {
        toast.error(response.error as string);
      } else {
        toast.success(user.isActive ? "Usuario bloqueado exitosamente" : "Usuario activado exitosamente");
        onRefresh();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado del usuario");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="size-8 p-0">
          <span className="sr-only">Abrir Menu</span>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="gap-2">
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(user.cedula);
            toast.success("Cédula copiada al portapapeles");
          }}
        >
          Copiar Cédula De Identidad
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Extras</DropdownMenuLabel>
        <DropdownMenuItem asChild className="w-full hover:bg-red-800">
          <Button
            className="w-full hover:bg-red-800"
            onClick={handleToggleActive}
            variant={user.isActive ? "destructive" : "default"}
          >
            {user.isActive ? "Bloquear" : "Activar"}
          </Button>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Dialog open={openEdit} onOpenChange={setOpenEdit}>
            <DialogTrigger
              className={`${buttonVariants({
                variant: "default",
              })} w-full`}
            >
              Editar
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar</DialogTitle>
                <DialogDescription asChild>
                  <div>
                    <DetailInfoUser
                      id={user.id}
                      onFinish={() => {
                        setOpenEdit(false);
                        onRefresh();
                      }}
                    />
                  </div>
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function buildColumns(
  departamentos: DepartamentoDTO[],
  roles: RolDTO[],
  onRefresh: () => void,
): ColumnDef<UsuarioDTO>[] {
  const getNombreDept = (id: number | null) =>
    departamentos.find((d) => d.id === id)?.nombre ?? "—";
  const getNombreRol = (id: number | null) =>
    roles.find((r) => r.id === id)?.nombreRol ?? "—";

  return [
    {
      accessorKey: "cedula",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cédula" />
      ),
    },
    {
      accessorKey: "nombres",
      header: "Nombres",
    },
    {
      accessorKey: "apellidos",
      header: "Apellidos",
    },
    {
      id: "rol",
      header: "Rol",
      cell: ({ row }) => getNombreRol(row.original.rolId),
    },
    {
      id: "departamento",
      header: "Departamento",
      cell: ({ row }) => getNombreDept(row.original.departamentoId),
    },
    {
      accessorKey: "isActive",
      header: "Activo/Bloqueado",
      cell: ({ getValue }) => {
        const active: boolean = getValue() as boolean;
        if (active) {
          return <Badge variant={"default"}>Activo</Badge>;
        }
        return <Badge variant={"destructive"}>Bloqueado</Badge>;
      },
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <UserActionsCell row={row} onRefresh={onRefresh} />,
    },
  ];
}

export default function TableUser({
  users,
  departamentos,
  roles,
  onRefresh,
}: {
  users: UsuarioDTO[];
  departamentos: DepartamentoDTO[];
  roles: RolDTO[];
  onRefresh: () => void;
}) {
  const columns = buildColumns(departamentos, roles, onRefresh);
  return (
    <div>
      <DataTable columns={columns} data={users || []} />
    </div>
  );
}
