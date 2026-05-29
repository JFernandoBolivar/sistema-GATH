"use client";

import { Code } from "@/app/types/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ColumnDef } from "@tanstack/react-table";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import UpdateCode from "./detail-info";
export const columnsCode: ColumnDef<Code>[] = [
  {
    accessorKey: "codigo",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Código
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: "denominacioncargo.cargo",
    header: "D.  Cargo",
  },
  {
    accessorKey: "denominacioncargoespecifico.cargo",
    header: "D.  Cargo Específico",
  },

  {
    accessorKey: "tiponomina.nomina",
    header: "Nomina",
  },
  {
    accessorKey: "OrganismoAdscrito.Organismoadscrito",
    header: "Org. Adscrito",
    cell: ({ getValue }) => {
      const orgAds = getValue();
      if (!orgAds) return "N/A";
      return orgAds;
    },
  },

  {
    accessorKey: "estatusid.estatus",
    header: "Estatus",
    cell: ({ getValue }) => {
      const status = getValue() as string;
      if (status == "VACANTE")
        return (
          <Badge variant={"default"} className="bg-green-700">
            {status}
          </Badge>
        );
      return <Badge variant={"destructive"}>{status}</Badge>;
    },
  },
  {
    accessorKey: "fecha_actualizacion",
    header: "F. Actualización",
    cell: ({ getValue }) => {
      const date = getValue() as Date;
      if (!date) return "N/A";
      return formatInTimeZone(date, "UTC", "dd/MM/yyy");
    },
  },
  {
    id: "actions",
    header: "Acciones",
    cell: ({ row }) => {
      const codigo = row.original;

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
              onClick={() => navigator.clipboard.writeText(codigo.codigo)}
            >
              Copiar Código
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <UpdateCode code={codigo} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
