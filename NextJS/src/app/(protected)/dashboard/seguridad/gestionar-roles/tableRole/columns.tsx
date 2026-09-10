"use client";
import { Role } from "@/app/types/types";
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
} from "@/components/ui/dropdown-menu";
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { ColumnDef, Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import deleteRoleAction from "../actions/delete-role-action";
import EditRole from "./edit-role";

function RoleActionsCell({ row }: { row: Row<Role> }) {
  const { mutate } = useSWRConfig();
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const role = row.original;

  const onDelete = () => {
    startTransition(async () => {
      const response = await deleteRoleAction(role.id);
      if (response.success) {
        toast.success(response.message);
        mutate("role");
      } else {
        // El backend responde 409 e informa a cuantas cuentas esta asignado
        toast.error(response.message);
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
            onClick={() => navigator.clipboard.writeText(role.nombre_rol)}
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
          <EditRole role={role} onFinish={() => setOpenEdit(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={openDelete} onOpenChange={setOpenDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Eliminar el rol {role.nombre_rol}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. No se podra eliminar si tiene
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

export const columns: ColumnDef<Role>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "nombre_rol",
    header: "Nombre Del Rol",
  },
  {
    accessorKey: "actions",
    header: "Acciones",
    cell: ({ row }) => <RoleActionsCell row={row} />,
  },
];
