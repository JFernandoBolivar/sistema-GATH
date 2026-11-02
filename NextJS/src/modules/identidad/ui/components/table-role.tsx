"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { DataTable } from "@/shared/ui/components/data-table";
import type { RolDTO } from "../../application/dtos/usuario-dto";
import { eliminarRolAction } from "../../infrastructure/actions/usuario-actions";
import EditRole from "./edit-role";

function RoleActionsCell({
  row,
  onRefresh,
}: {
  row: Row<RolDTO>;
  onRefresh: () => void;
}) {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const role = row.original;

  const onDelete = () => {
    startTransition(async () => {
      try {
        const response = await eliminarRolAction(role.id);
        if (response && typeof response === "object" && "error" in response) {
          toast.error(response.error as string);
        } else {
          toast.success("Rol eliminado exitosamente");
          onRefresh();
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al eliminar el rol");
      }
      setOpenDelete(false);
    });
  };

  return (
    <>
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
              navigator.clipboard.writeText(role.nombreRol);
              toast.success("Nombre del rol copiado");
            }}
          >
            Copiar Nombre Del Rol
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Extras</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setOpenEdit(true)}>
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setOpenDelete(true)}
            variant="destructive"
          >
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Rol</DialogTitle>
            <DialogDescription>
              Si cambia el nombre, el rol deja de coincidir con los permisos
              configurados en el sistema.
            </DialogDescription>
          </DialogHeader>
          <EditRole
            role={role}
            onFinish={() => {
              setOpenEdit(false);
              onRefresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar el rol {role.nombreRol}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. No se podrá eliminar si tiene
              cuentas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                onDelete();
              }}
            >
              {isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function buildRoleColumns(onRefresh: () => void): ColumnDef<RolDTO>[] {
  return [
    {
      accessorKey: "id",
      header: "ID",
    },
    {
      accessorKey: "nombreRol",
      header: "Nombre Del Rol",
    },
    {
      id: "actions",
      header: "Acciones",
      cell: ({ row }) => <RoleActionsCell row={row} onRefresh={onRefresh} />,
    },
  ];
}

export default function TableRole({
  roles,
  onRefresh,
}: {
  roles: RolDTO[];
  onRefresh: () => void;
}) {
  const columns = buildRoleColumns(onRefresh);
  return (
    <div>
      <DataTable columns={columns} data={roles || []} />
    </div>
  );
}
