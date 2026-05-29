"use client";
import { UserSystem } from "@/app/types/types";
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
} from "@/components/ui/dropdown-menu";
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { mutate } from "swr";
import { blockUserAction } from "../action/update-user-action";
import { DataTableColumnHeader } from "./data-table-column-header";
import DetailInfoUser from "./detail-info";
import { useSearchStore } from "@/hooks/use-search-params";
export const columns: ColumnDef<UserSystem>[] = [
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
    accessorKey: "rol.nombre_rol",
    header: "Rol",
  },
  {
    accessorKey: "departamento.nombre_departamento",
    header: "Departamento",
  },
  {
    accessorKey: "is_active",
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
    accessorKey: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const searchParams = useSearchStore((state) => state.searchParams);
      const user = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir Menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="gap-2">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(user.cedula)}
            >
              Copiar Cédula De Identidad
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Extras</DropdownMenuLabel>
            <DropdownMenuItem asChild className="w-full hover:bg-red-800">
              <Button
                className="w-full hover:bg-red-800"
                onClick={() => {
                  blockUserAction(user.id, user.is_active).then((response) => {
                    if (response.success) {
                      toast.success(response.message);
                      mutate(["/api/users", searchParams]);
                    } else {
                      toast.error(response.message);
                    }
                  });
                }}
                variant={user.is_active ? "destructive" : "default"}
              >
                {user.is_active ? "Bloquear" : "Activar"}
              </Button>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Dialog>
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
                    <DialogDescription>
                      <DetailInfoUser id={user.id} />
                    </DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
