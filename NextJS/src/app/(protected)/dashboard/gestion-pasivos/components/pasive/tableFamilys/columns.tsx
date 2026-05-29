"use client";

import { ColumnDef } from "@tanstack/react-table";

import { Family } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { DataTableColumnHeader } from "./data-table-column-header";
import { DetailInfoFamily } from "./detail-info";
import { Badge } from "@/components/ui/badge";
import { formatInTimeZone } from "date-fns-tz";

export const columnsFamily: ColumnDef<Family>[] = [
  {
    id: "Cedula",
    accessorKey: "cedulaFamiliar",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cedula" />
    ),
  },
  {
    id: "Primer Nombre",

    accessorKey: "primer_nombre",
    header: "Primer Nombre",
  },
  {
    id: "Primer Apellido",
    accessorKey: "primer_apellido",
    header: "Primer Apellido",
  },
  {
    id: "Parentesco",
    accessorKey: "parentesco.descripcion_parentesco",
    header: "Parentesco",
  },
  {
    id: "Edad",
    accessorKey: "fechanacimiento",
    header: "F. Nacimiento",
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
    id: "Heredero",
    accessorKey: "heredero",
    header: "Heredero",
    cell: ({ getValue }) => {
      const heredero = getValue() as boolean;
      return (
        <Badge variant={heredero ? "default" : "destructive"}>
          {" "}
          {heredero ? "Heredero" : "No Heredero"}
        </Badge>
      );
    },
  },
  {
    id: "Acciones",
    header: "Acciones",
    cell: ({ row }) => {
      const family = row.original;

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
                navigator.clipboard.writeText(family.cedulaFamiliar)
              }
            >
              Copiar C. Familar
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <DetailInfoFamily family={family} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
