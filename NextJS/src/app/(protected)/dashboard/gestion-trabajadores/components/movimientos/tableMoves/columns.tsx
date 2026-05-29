"use client";
import { EmployeeCargoHistory } from "@/app/types/types";
import { Button } from "@/components/ui/button";
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
import { DataTableColumnHeader } from "./data-table-column-header";
import { formatInTimeZone } from "date-fns-tz";
import { DetailInfoMoves } from "./detail-info";

export const columns: ColumnDef<EmployeeCargoHistory>[] = [
  {
    accessorKey: "codigo_puesto",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Código Puesto" />
    ),
    cell: ({ getValue }) => {
      const codigo = getValue() as string;
      return <span>{codigo || "N/A"}</span>;
    },
  },
  {
    accessorKey: "fecha_movimiento",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fecha Movimiento" />
    ),
    cell: ({ getValue }) => {
      const fecha = getValue() as string;
      return (
        <span>
          {fecha ? formatInTimeZone(fecha, "UTC", "dd/MM/yyyy") : "N/A"}
        </span>
      );
    },
  },
  {
    accessorKey: "motivo_movimiento.movimiento",
    header: "Tipo de Movimiento",
    cell: ({ getValue }) => {
      const movimiento = getValue() as string;
      return <span>{movimiento || "N/A"}</span>;
    },
  },
  {
    accessorKey: "new_denominacioncargo.cargo",
    header: "Nuevo Cargo",
    cell: ({ getValue }) => {
      const cargo = getValue() as string;
      return <span>{cargo || "N/A"}</span>;
    },
  },
  {
    accessorKey: "new_grado.grado",
    header: "Nuevo Grado",
    cell: ({ getValue }) => {
      const grado = getValue() as string;
      return <span>{grado || "N/A"}</span>;
    },
  },
  {
    accessorKey: "modificado_por_usuario",
    header: "Modificado Por",
    cell: ({ getValue }) => {
      const usuario = getValue() as string;
      return <span>{usuario || "N/A"}</span>;
    },
  },
  {
    accessorKey: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const movimento = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir Menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard.writeText(movimento.codigo_puesto)
              }
            >
              Copiar Código Puesto
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Detalles</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <DetailInfoMoves movement={movimento} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
