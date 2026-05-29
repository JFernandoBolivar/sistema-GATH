"use client";

import { Leaving } from "@/app/types/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { MoreHorizontal } from "lucide-react";

export const columnsLeavingReport: ColumnDef<Leaving>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const leaving = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() =>
                navigator.clipboard.writeText(leaving.id.toString())
              }
            >
              Copiar C. Identidad
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
  {
    accessorKey: "cedula",
    header: "C. Identidad",
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
    accessorKey: "fechaingresoorganismo",
    header: "Fecha De Ingreso",
    cell: ({ getValue }) => {
      const fecha = getValue() as Date;
      if (!fecha) return <Badge className="bg-red-600">N/A</Badge>;
      return formatInTimeZone(new Date(fecha),"UTC", "dd/mm/yyyy");
    },
  },
  {
    accessorKey: "fecha_egreso",
    header: "Fecha De Egreso",
    cell: ({ getValue }) => {
      const fecha = getValue() as Date;
      if (!fecha) return <Badge className="bg-red-600">N/A</Badge>;
      return formatInTimeZone(new Date(fecha),"UTC", "dd/mm/yyyy");
    },
  },
];
